
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
 * A *notation function* will be a function that inspects a text string and does
 * the following two things:
 * 
 *  1. If the text string does not correctly express one, single,
 *     non-environment Logic Concept in the expected notation, return an error
 *     object as described below.
 *  2. Otherwise, return the Logic Concept instance described by the input.
 * 
 * An error object must have a `message` field, containing a string describing
 * the problem in a human-readable way.  It may optionally also have a
 * `position` field, an integer between 0 and the length of the input
 * (inclusive) indicating where the problem occurred.  Indexes into the input
 * range from 0 to one less than its length, and so an error position equal to
 * the input length can be used to express that something was missing at the end
 * of the input, such as a close grouper.
 * 
 * This module installs one notation function, one supporting putdown notation,
 * as described above.  It also provides functions clients can use to install
 * additional notation functions, or query the set of currently installed ones.
 * 
 * @module Notation
 */

import { LogicConcept, Environment }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

// Internal use only
// Stores the map from notation names to notation functions
const notationFunctions = new Map()

/**
 * Install a new notation function into this module.  Provide the name of the
 * notation, together with a function whose behavior works as documented
 * {@link module:Notation at the top of this module}.  If you call this function
 * more than once with the same name, you will overwrite any function you
 * installed in the past for the same name with the new function.
 * 
 * @param {string} name - the name of the notation
 * @param {function} func - the notation function, with signature and behavior
 *   as documented at the top of this module
 */
export const addFunction = ( name, func ) => notationFunctions.set( name, func )

/**
 * This function returns a list of all the installed notation functions, which
 * is just a list of their names, each one a string.
 * 
 * @returns {string[]} the names of all installed notation functions
 */
export const names = () => Array.from( notationFunctions.keys() )

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
 */
export const parse = ( input, notationName ) => {
    if ( !notationFunctions.has( notationName ) )
        throw new Error( `No such notation: ${notationName}` )
    return notationFunctions.get( notationName )( input )
}

// Internal use only
// Installs default notation, which is putdown
addFunction( 'putdown', code => {
    try {
        const LCs = LogicConcept.fromPutdown( code )
        if ( LCs.length == 0 )
            return { message : 'Your code contains no expressions.' }
        if ( LCs.length > 1 )
            return { message : 'Your code contains more than one expression.' }
        const result = LCs[0]
        if ( result.hasDescendantSatisfying( d => d instanceof Environment ) )
            return { message : 'Your code includes an environment.' }
        return result
    } catch ( e ) {
        const match = /^(.*), line \d+ col (\d+)$/.exec( e )
        if ( match ) {
            return { message : match[1], position : parseInt( match[2] ) }
        } else {
            return { message : 'Your code is not valid putdown notation.' }
        }
    }
} )
