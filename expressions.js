
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting an inline atom into the document, one that allows the user to write
 * mathematical expressions using any of the parsers defined in the
 * {@link module:Notation notation module}.
 * 
 * @module NotationAtoms
 */

import { Atom } from './atoms.js'
import { lookup } from './document-settings.js'
import { Dialog, TextInputItem, SelectBoxItem, HTMLItem, AlertItem } from './dialog.js'
import { parse, names as notationNames, usesMathEditor, represent } from './notation.js'
import { escapeHTML } from './utilities.js'
import { phrasesInForceAt } from './math-phrases.js'
import { MathItem } from './math-live.js'

/**
 * Install into a TinyMCE editor instance a new menu item:
 * "Expression," intended for the Insert menu.  It adds an inline atom to the
 * user's document, with default content just one identifier, the word
 * "expression."  If the user clicks it, they can then change the content in a
 * popup dialog.  The dialog will ensure that the user can save their edits only
 * if those edits are judged, by the notation function for the expression, to be
 * valid code under that notation.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'expression', {
        text : 'Expression',
        icon : 'insert-character',
        tooltip : 'Insert math in simple notation',
        shortcut : 'Meta+E',
        onAction : () => {
            const atom = Atom.newInline( editor, '', {
                type : 'notation',
                code : '',
                // use the notation language specified in the document settings:
                notation : lookup( editor, 'notation' )
            } )
            atom.update()
            atom.editThenInsert()
        }
    } )
}

/**
 * Create the HTML for an expression atom with the given content and notation.
 * This type of expression atom is written in the given notation, and is not an
 * instance of any math phrase.
 * 
 * @param {string} content - the content of the expression, written in the
 *   notation named in the second argument
 * @param {string} notation - the name of the notation that should be used
 *   (e.g., putdown or smackdown)
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which the
 *   expression may eventually be inserted (used primarily for constructing
 *   HTML elements using its document object)
 * @function
 * @see {@link module:NotationAtoms.phraseHTML phraseHTML()}
 */
export const expressionHTML = ( content, notation, editor ) => {
    const atom = Atom.newInline( editor, '', {
        type: 'notation',
        code: content,
        notation: notation
    } )
    atom.update()
    return atom.getHTML()
}

/**
 * Create the HTML for an expression atom that is the default instantiation of
 * the given math phrase.
 * 
 * @param {Atom} phrase - the Atom representing the math phrase to instantiate
 *   (as defined in {@link module:MathPhrases Math Phrases})
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which the
 *   expression may eventually be inserted (used primarily for constructing
 *   HTML elements using its document object)
 * @function
 * @see {@link module:NotationAtoms.expressionHTML expressionHTML()}
 */
export const phraseHTML = ( phrase, editor ) => {
    const notation = phrase.getMetadata( 'name' )
    const atom = Atom.newInline( editor, '', { type : 'notation', notation } )
    const paramNames = phrase.getMetadata( 'paramNames' ).split( /\s*,\s*/ )
    paramNames.forEach( param => atom.setMetadata( `param-${param}`, param ) )
    atom.update( phrase )
    return atom.getHTML()
}

// Utility functions used in the edit handler defined below.
// These are not documented here because they are small tools for internal use.
// This one is for creating input controls for either plain text or WYSIWYG math.
const inputControl = ( name, notation, label, placeholder ) =>
    usesMathEditor( notation ) ? new MathItem( name, label )
                               : new TextInputItem( name, label, placeholder || name )
// This one sets up a dialog for editing an atom using some notation, like putdown.
const setUpNotationDialog = ( dialog, atom, notation ) => {
    dialog.addItem( inputControl( 'code', notation, 'Expression' ) )
    dialog.setInitialData( {
        code : atom.getMetadata( 'code' ),
        notation : notation
    } )
    if ( notation == 'math editor' )
        dialog.items.find( item => item.name == 'code' )?.setFocusWhenShown( true )
    else
        dialog.setDefaultFocus( 'code' )
}
// This one takes a dialog like the one set up above and saves its edits into the atom.
const applyNotationDialog = ( dialog, atom ) => {
    atom.setMetadata( 'code', dialog.get( 'code' ) )
    atom.update()
}
// This one sets up a dialog for editing a math phrase (not a math phrase definition,
// but an expression that is an instance of a particular math phrase defined elsewhere).
const setUpPhraseDialog = ( dialog, atom, phrase ) => {
    const html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
    const internal = phrase.getMetadata( 'codeTemplate' )
    const paramNotation = phrase.getMetadata( 'notation' )
    dialog.addItem( new HTMLItem( `
        <div style='margin-top: 1em; margin-bottom: 1em;'>
            <p>External representation: ${html}</p>
            <p>Internal representation (in ${paramNotation}):
                ${escapeHTML(internal)}</p>
        </div>
    ` ) )
    const initialData = { notation : phrase.getMetadata( 'name' ) }
    const params = phrase.getMetadata( 'paramNames' ).split( ',' )
        .map( name => name.trim() )
    params.forEach( param => {
        const key = `param-${param}`
        dialog.addItem( inputControl( key, paramNotation, param, param ) )
        initialData[key] = atom.getMetadata( key ) || param
    } )
    if ( params.length > 0 )
        dialog.setDefaultFocus( `param-${params[0]}` )
    else
        dialog.setDefaultFocus( 'notation' )
    dialog.setInitialData( initialData )
}
// This one takes a dialog like the one set up above and saves its edits into the atom.
const applyPhraseDialog = ( dialog, atom, phrase ) => {
    const params = phrase.getMetadata( 'paramNames' ).split( ',' )
        .map( name => name.trim() )
    params.forEach( param => {
        const key = `param-${param}`
        atom.setMetadata( key, dialog.get( key ) )
    } )
    atom.update( phrase )
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'notation', {
    edit : function () {
        // get all relevant data from the atom and the document
        const dialog = new Dialog( 'Edit expression', this.editor )
        const accessiblePhrases = phrasesInForceAt( this )
        const nameToPhrase = name => accessiblePhrases.find( phrase =>
            phrase.getMetadata( 'name' ) == name )
        let notation = this.getMetadata( 'notation' )
        // define a re-usable function for setting up the dialog, because we may
        // need to run this function multiple times, if the user chooses to
        // change the type of expression being edited, in the notation drop-down
        const setUpDialog = () => {
            // clear all
            while ( dialog.items.length > 0 ) dialog.removeItem( 0 )
            // add the dropdown that's always present
            dialog.addItem( new SelectBoxItem( 'notation', 'Type of expression', [
                ...notationNames(),
                ...accessiblePhrases.map( phrase => phrase.getMetadata( 'name' ) )
            ] ) )
            // if it's just text in some notation, set up the dialog for that
            if ( notationNames().includes( notation ) ) {
                setUpNotationDialog( dialog, this, notation )
                return
            }
            // if it's a math phrase, set up the dialog for that, after we
            // ensure it exists (showing an error if it doesn't)
            const phrase = nameToPhrase( notation )
            if ( !phrase ) {
                dialog.addItem( new AlertItem( 'error', `Invalid type: ${notation}` ) )
                return
            }
            setUpPhraseDialog( dialog, this, phrase )
        }
        // If the user changes the type of expression being edited, we need to
        // set up the dialog again to match the new type of expression.
        dialog.onChange = ( _, component ) => {
            if ( component.name != 'notation' ) return
            notation = dialog.get( 'notation' )
            setUpDialog()
            dialog.reload()
        }
        // Set the dialog up for the first time.
        setUpDialog()
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // store notation from the dropdown that's always present
            this.setMetadata( 'notation', notation )
            // if it's just text in some notation, save in the appropriate manner
            if ( notationNames().includes( notation ) ) {
                applyNotationDialog( dialog, this )
                return true
            }
            // if it's a math phrase, ensure it exists (throwing an error if it
            // doesn't) and then save in a manner suitable to all its parameters
            const phrase = nameToPhrase( notation )
            if ( !phrase )
                throw new Error( `No such math phrase: ${notation}` )
            applyPhraseDialog( dialog, this, phrase )
            return true
        } )
    },
    toLCs : function () {
        // Ensure this expression wants to be included in the output
        const code = this.getMetadata( 'code' )
        const notation = this.getMetadata( 'notation' )
        if ( !code || !notation ) return [ ]
        // If this expression is just plain code, parse it and return the result
        const phrase = phrasesInForceAt( this ).find(
            phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) return parse( code, notation )
        // If this expression is a math phrase, build its code and parse that
        let template = phrase.getMetadata( 'codeTemplate' )
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                template = template.replaceAll( param, value )
            }
        } )
        const paramNotation = phrase.getMetadata( 'notation' )
        return parse( template, paramNotation )
    },
    // this update function can optionally accept a "phrase" parameter, which
    // will prevent us from searching for a math phrase in force at this atom;
    // this is useful for constructing HTML of phrases that aren't actually in
    // the document, so technically nothing is "in force" at their location.
    update : function ( phrase ) {
        const notation = this.getMetadata( 'notation' )
        if ( !phrase )
            phrase = phrasesInForceAt( location || this ).find(
                phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) {
            const code = this.getMetadata( 'code' )
            const repr = `${represent( code, notation )}`
            this.fillChild( 'body', repr )
            return
        }
        let html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
        const paramNotation = phrase.getMetadata( 'notation' )
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                html = html.replaceAll( param, represent( value, paramNotation ) )
            }
        } )
        this.fillChild( 'body', html )
    }
} )

export default { install }
