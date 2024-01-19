
/**
 * For the purposes of this module, a *notation* will be any way in which one
 * can encode, as a text string, a non-environment Logic Concept.  (For the
 * definition of Logic Concepts, or LCs, refer to the documentation in
 * {@link https://lurchmath.github.io/lde/LogicConcept.html another repository}.)
 * For example, putdown notation, as
 * {@link https://lurchmath.github.io/lde/LogicConcept.html#.fromPutdown
 * defined in that repository}, is an example of a "notation," according to this
 * definition.
 * 
 * A *parsing function* will be a function that inspects a text string and does
 * the following two things:
 * 
 *  1. If the text string does not correctly express one or more Logic Concepts
 *     in the expected notation, return an error object as described below.
 *  2. Otherwise, return a JavaScript array containing the Logic Concept
 *     instance(s) described by the input.  You must return an array in any
 *     case, even if there is exactly one Logic Concept in it.
 * 
 * An error object must have a `message` field, containing a string describing
 * the problem in a human-readable way.  It may optionally also have a
 * `position` field, an integer between 0 and the length of the input
 * (inclusive) indicating where the problem occurred.  Indexes into the input
 * range from 0 to one less than its length, and so an error position equal to
 * the input length can be used to express that something was missing at the end
 * of the input, such as a close grouper.
 * 
 * A *representation function* will be a function that accepts as input the same
 * notation you would pass to the corresponding parsing function, but instead of
 * producing a Logic Concept instance, it produces a text string containing the
 * HTML representation of the meaning.  For instance, the representation for
 * putdown notation could be just the code in fixed-width font, but the
 * representation for $\LaTeX$ could be the typeset version in HTML.
 * 
 * This module installs multiple parsing and representation functions, including
 * ones for putdown, smackdown, $\LaTeX$, and WYSIWYG math editing.  It also
 * provides functions clients can use to install additional parsing and
 * representation functions, or query the set of currently installed ones.
 * 
 * @module Notation
 */

import { LogicConcept, MathConcept } from './lde-cdn.js'
import { getConverter } from './math-live.js'
import { escapeHTML } from './utilities.js'

// Internal use only
// Stores the map from notation names to parsing functions
const parsingFunctions = new Map()
// Stores the map from notation names to representation functions
const representationFunctions = new Map()
// Stores which of the notation names should be edited using a math editor
// (as opposed to just a plain text input)
const namesUsingMathEditor = new Set()

/**
 * Install a new parsing function into this module.  Provide the name of the
 * notation, together with a function whose behavior works as documented
 * {@link module:Notation at the top of this module}.  If you call this function
 * more than once with the same name, you will overwrite any function you
 * installed in the past for the same name with the new function.
 * 
 * @param {string} name - the name of the notation
 * @param {function} func - the parsing function, with signature and behavior
 *   as documented at the top of this module
 * @see {@link module:Notation.names names()}
 * @see {@link module:Notation.markNameAsMath markNameAsMath()}
 * @see {@link module:Notation.addRepresentation addRepresentation()}
 * @function
 */
export const addParser = ( name, func ) => parsingFunctions.set( name, func )

/**
 * Install a new representation function into this module.  Provide the name of
 * the notation, together with a function whose behavior works as documented
 * {@link module:Notation at the top of this module}.  If you call this function
 * more than once with the same name, you will overwrite any function you
 * installed in the past for the same name with the new function.
 * 
 * @param {string} name - the name of the notation
 * @param {function} func - the representation function, with signature and
 *   behavior as documented at the top of this module
 * @see {@link module:Notation.names names()}
 * @see {@link module:Notation.addParser addParser()}
 * @function
 */
export const addRepresentation = ( name, func ) =>
    representationFunctions.set( name, func )

/**
 * This function returns a list of all the installed parsing functions, which
 * is just a list of their names, each one a string.
 * 
 * @returns {string[]} the names of all installed parsing functions
 * @see {@link module:Notation.addParser addParser()}
 * @see {@link module:Notation.markNameAsMath markNameAsMath()}
 * @function
 */
export const names = () => Array.from( parsingFunctions.keys() )

/**
 * Mark any of the names you've installed using
 * {@link module:Notation.addParser addParser()} as one that should be
 * edited in the UI using a math editor, as opposed to a plain text input.
 * The default is that all notations are written in plain text, but if you mark
 * one with this function as requiring a math editor, then all dialogs that let
 * the user write in that notation will present a math editor instead of a plain
 * text box.
 * 
 * @param {string} name - the name of the notation
 * @see {@link module:Notation.addParser addParser()}
 * @see {@link module:Notation.names names()}
 * @see {@link module:Notation.usesMathEditor usesMathEditor()}
 * @function
 */
export const markNameAsMath = name => namesUsingMathEditor.add( name )

/**
 * Check whether the given notation has been marked as a mathematical one, using
 * the {@link module:Notation.markNameAsMath markNameAsMath()} function.
 * 
 * @param {string} name - the name of the notation to check
 * @returns {boolean} whether the given name uses a WYSIWYG math editor when
 *   the user is typing in content using that notation
 * @see {@link module:Notation.markNameAsMath markNameAsMath()}
 * @function
 */
export const usesMathEditor = name => namesUsingMathEditor.has( name )

/**
 * Apply the parser for a given notation to some text input.  Return either a
 * Logic Concept (if the input was understandable as an expression in the given
 * notation, according to the rules {@link module:Notation at the top of this
 * module}), or an error object otherwise (also structured according to that
 * same documentation).
 * 
 * @param {string} input - the input to be parsed
 * @param {string} notationName - the name of the notation function to use for
 *   parsing
 * @returns {LogicConcept|Object} either a LogicConcept instance, upon success,
 *   or an error object, upon failure, as described above
 * @function
 */
export const parse = ( input, notationName ) => {
    if ( !parsingFunctions.has( notationName ) )
        throw new Error( `No parser for ${notationName}` )
    return parsingFunctions.get( notationName )( input )
}

/**
 * Apply the representation function for a given notation to some text input.
 * Return the output of that representation function, if one for that notation
 * is installed, or throw an error if none is installed.
 * 
 * @param {string} code - the code to be represented in HTML
 * @param {string} notationName - the name of the notation in which the code is
 *   expressed
 * @returns {string} the HTML representation of the code
 * @function
 */
export const represent = ( code, notationName ) => {
    if ( !representationFunctions.has( notationName ) )
        throw new Error( `No representation function for ${notationName}` )
    return representationFunctions.get( notationName )( code )
}

// Internal use only
let mathConverter = null
if ( typeof( document ) != 'undefined' )
    getConverter().then( result => mathConverter = result )
// Installs a MathLive notation via an equation editor UI
addParser( 'math editor', latex =>
    parse( mathConverter?.( latex, 'latex', 'putdown' ), 'putdown' ) )
addRepresentation( 'math editor', latex =>
    mathConverter?.( latex, 'latex', 'html' ) )
markNameAsMath( 'math editor' )
// Installs LaTeX as a language (that can be interpreted under the hood
// using putdown)
addParser( 'latex', latex =>
    parse( mathConverter?.( latex, 'latex', 'putdown' ), 'putdown' ) )
addRepresentation( 'latex', latex =>
    mathConverter?.( latex, 'latex', 'html' ) )
// Installs Lurch notation as a language (that can be interpreted under the hood
// using putdown)
addParser( 'lurchNotation', lurchNotation =>
    parse( mathConverter?.( lurchNotation, 'lurch', 'putdown' ), 'putdown' ) )
addRepresentation( 'lurchNotation', lurchNotation =>
    mathConverter?.( lurchNotation, 'lurch', 'html' ) )

// Internal use only
// Installs default notation, which is putdown
addParser( 'putdown', code => {
    try {
        const LCs = LogicConcept.fromPutdown( code )
        if ( LCs.length == 0 )
            return { message : 'Your code contains no expressions.' }
        return LCs
    } catch ( e ) {
        const match = /^(.*), line \d+ col (\d+)$/.exec( e )
        if ( match ) {
            return { message : match[1], position : parseInt( match[2] ) }
        } else {
            return { message : 'Your code is not valid putdown notation.' }
        }
    }
} )
addRepresentation( 'putdown', code =>
    `<tt class='putdown-notation'>${escapeHTML(code)}</tt>`  )

// Internal use only
// Installs a second notation, smackdown
addParser( 'smackdown', code => {
    try {
        const MCs = MathConcept.fromSmackdown( code )
        if ( MCs.length == 0 )
            return { message : 'Your code contains no expressions.' }
        return MCs.map( m => m.interpret() )
    } catch ( e ) {
        const match = /^(.*), line \d+ col (\d+)$/.exec( e )
        if ( match ) {
            return { message : match[1], position : parseInt( match[2] ) }
        } else {
            return { message : 'Your code is not valid smackdown notation.' }
        }
    }
} )
addRepresentation( 'smackdown', code =>
    `<tt class='smackdown-notation'>${escapeHTML(code)}</tt>`  )

// Internal use only - HTML-formatting functions used below
const heading = text =>
    `<div style="background-color: #eeeeee; border: solid 1px #888888; padding: 0.5em;"
    >${text}</div>`
const content = text =>
    `<div style="border: solid 1px #888888; padding: 0.5em;"
    >${text}</div>`
const bulletize = list => list.length == 0 ? '' :
    '<ul>' + list.map( x => `<li>${x}</li>` ).join( '\n' ) + '</ul>'
const formatKeyValuePair = ( key, value ) => {
    if ( key.startsWith( '_type_' ) && ( value === true ) ) {
        return `Attribute: is a "${key.substring( 6 )}"`
    } else {
        return `Attribute: ${key} = ${escapeHTML( JSON.stringify( value ) )}`
    }
}

/**
 * Create a universally understandable HTML representation for any LC or array
 * of LCs.  This will be used as a debugging tool for any power user who wants
 * to see a syntax-tree-like representation of any atom in their document.  This
 * is the more user-friendly version of {@link module:Notation.putdownHTML
 * putdownHTML()}.
 * 
 * @param {LogicConcept | LogicConcept[]} LC - the LogicConcept to be
 *   represented, or an array of LogicConcepts to be represented
 * @returns {string} the HTML representation of the LogicConcept(s)
 * @function
 * @see {@link module:Notation.putdownHTML putdownHTML()}
 */
export const syntaxTreeHTML = LC => {
    // Base case: If it is one LC, build a hierarchical bulleted list.
    if ( !( LC instanceof Array ) ) {
        let attributes = LC =>
            LC.getAttributeKeys().filter( key => key != 'symbol text' ).map(
                key => formatKeyValuePair( key, LC.getAttribute( key ) ) )
        if ( LC.constructor.className == 'Symbol' )
            return escapeHTML( LC.text() ) + bulletize( attributes( LC ) )
        else
            return LC.constructor.className + '\n' + bulletize( [
                ...attributes( LC ), ...LC.children().map( syntaxTreeHTML )
            ] )
    }
    // Inductive step: If it is an array of LCs, process them one at a time and
    // put the results in a series of DIVs with headings.
    // We manually add styles on each element because the output needs to be
    // usable in TinyMCE dialogs, which are draconian about how they override
    // your styles, unless you put them on the actual elements, thus overriding
    // TinyMCE's stylesheet.
    let html = ''
    LC.map( ( oneLC, index ) => {
        html += heading( `Logic Concept ${index+1} of ${LC.length}:` )
        html += content( syntaxTreeHTML( oneLC ) )
    } )
    return `<div class="LC-meaning-preview">${html}</div>`
}

/**
 * Create an HTML representation of the putdown notation for any LC or array
 * of LCs.  This will be used as a debugging tool for any power user who wants
 * to see the code for any atom in their document.  This is the more technical
 * version of {@link module:Notation.syntaxTreeHTML syntaxTreeHTML()}.
 * 
 * @param {LogicConcept | LogicConcept[]} LC - the LogicConcept to be
 *   represented, or an array of LogicConcepts to be represented
 * @returns {string} the HTML representation of the LogicConcept(s)
 * @function
 * @see {@link module:Notation.syntaxTreeHTML syntaxTreeHTML()}
 */
export const putdownHTML = LC => {
    // Base case: If it is one LC, just use putdown.
    if ( !( LC instanceof Array ) ) return LC.toPutdown()
    // Inductive step: If it is an array of LCs, process them one at a time.
    // We manually add styles on each element because the output needs to be
    // usable in TinyMCE dialogs, which are draconian about how they override
    // your styles, unless you put them on the actual elements, thus overriding
    // TinyMCE's stylesheet.
    let putdown = ''
    LC.map( ( oneLC, index ) => {
        putdown += `// Logic Concept ${index+1} of ${LC.length}:\n`
        putdown += oneLC.toPutdown() + '\n\n'
    } )
    return `<div class="LC-code-preview">
        <div style="font-family: monospace; white-space: pre;"
        >${putdown}</pre></div>`
}
