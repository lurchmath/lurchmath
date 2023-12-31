
/**
 * This module makes it easy for various parts of the Lurch app to easily and
 * consistently add new autocompletion tools.  It encapsulates a few assumptions
 * about how autocompletion will work in the Lurch app, so that those
 * assumptions do not need to be repeated throughout the codebase, wherever any
 * file needs to add autocompletion support.
 * 
 * For example, this module ensures that all autocompletions begin with a
 * backslash, because that is a design decision we've made to imitate the
 * well-known mathematics notation in $\LaTeX$.  The module also ensures that
 * previews for autocompletions are shown in a single-column menu, one line per
 * item, with the shortcut and the potential insertion displayed together.
 * 
 * This is built upon TinyMCE's existing autocompletion functionality.  This
 * module provides only a thin layer on top of that functionality to streamline
 * the process of making all autocompletions in Lurch behave consistently, with
 * minimal coding needed on the part of the various modules in the Lurch UI.
 * 
 * It also installs an autocompletion that uses `$...$` notation, in imitation
 * of $\LaTeX$ inline math expressions.  That autocompletion allows the user to
 * replace any content between dollar signs with an expression, in the user's
 * default notation, in the sense of the {@link module:ExpressionAtoms expressions
 * in the Notation Atoms module}.
 * 
 * Clients can import this module and then call its
 * {@link module:AutoComplete.install install()} function to add autocompletion
 * support to TinyMCE.
 * 
 * @module AutoComplete
 */

import { lookup } from './document-settings.js'
import { expressionHTML } from './expressions.js'
import { getConverter, stylesheet } from './math-live.js'
import { DeclarationType, declarationHTML } from './declarations.js'
import { loadScript, loadStylesheet, htmlToImage } from './utilities.js'

// Internal use: Stores all autocompletion functions.
// An autocompletion function has the signature documented below.
const autocompleteFunctions = [ ]

/**
 * Add a new autocompletion function to this module.  When the user types the
 * trigger character into their document (which in Lurch is a backslash, `\`),
 * every autocomplete function installed in this module will be called on the
 * current editor, and each can return a JavaScript array of autocompletions.
 * Those arrays will all be concatenated and used to suggest autocompletion
 * options to the user.
 * 
 * The signature of an autocompletion function is as follows:  It takes as input
 * a single parameter, the TinyMCE Editor instance in which the user typed a
 * backslash, thus invoking autocompletion.  It returns a JavaScript array of
 * autocompletion records, each of which is a JavaScript object containing the
 * following three fields.
 * 
 *  * `shortcut` - the shortcut that will trigger the autocompletion, if the
 *    user types it (and which will be used to filter the autocompletion list to
 *    those relevant to what the user has typed so far)
 *  * `content` - the HTML content that will be inserted into the user's
 *    document (replacing the shortcut) if the user accepts this autocompletion
 *  * `preview` - a string that describes the autocompletion in a single line,
 *    for displaying to the user in a menu as part of the autocompletion UI
 * 
 * For example, if the user has typed `\a`, and the autocompletion function
 * has returned an array containing autocompletions for `\apple` and `\ant`,
 * as well as several others that do not begin with `\a`, only the completions
 * for `\apple` and `\ant` will be shown.  If the user chooses `\apple`, then
 * that text will disappear and be replaced by the content for the `\apple`
 * autocompletion.
 * 
 * @param {Function} f - the autocompletion function to add, with a signature as
 *   documented above
 */
export const addAutocompleteFunction = f => autocompleteFunctions.push( f )

/**
 * Install autocompletion support in a TinyMCE Editor.  See the documentation at
 * {@link module:AutoComplete the top of this module} for details.
 * 
 * @param {tinymce.Editor} editor - the editor into which to install support for
 *   autocompletion
 */
export const install = editor => {
    // First, the autocompleter that is extensible using the
    // addAutocompleteFunction() API given above:
    editor.ui.registry.addAutocompleter( 'lurch-general-complete', {
        trigger : '\\',
        minChars : 0,
        columns : 1,
        onAction : ( autocompleter, range, newContent ) => {
            editor.selection.setRng( range )
            editor.insertContent( newContent )
            autocompleter.hide()
        },
        fetch : pattern => Promise.resolve(
            autocompleteFunctions.map( f => f( editor ) )
            .flat()
            .filter( completion => completion.shortcut.startsWith( pattern ) )
            .map( completion => ( {
                type : 'cardmenuitem',
                value : completion.content,
                label : completion.preview,
                items : [
                    {
                        type : 'cardtext',
                        text : `\\${completion.shortcut}: ${completion.preview}`
                    }
                ]
            } ) )
        )
    } )
    // Second, the autocompleter that is just for expressions in one of the
    // pre-installed notations from notations.js:
    editor.ui.registry.addAutocompleter( 'lurch-expression-autocomplete', {
        trigger : '$',
        minChars : 1,
        columns : 1,
        onAction : ( autocompleter, range, newContent ) => {
            editor.selection.setRng( range )
            editor.insertContent( newContent )
            autocompleter.hide()
        },
        fetch : pattern => {
            let exprCode = pattern.replaceAll( '\\\\', '' ).replaceAll( '\\$', '' )
            if ( !exprCode.endsWith( '$' ) )
                return Promise.resolve( [ ] )
            exprCode = exprCode.substring( 0, exprCode.length - 1 )
            if ( exprCode.includes( '$' ) )
                return Promise.resolve( [ ] )
            const notation = lookup( editor, 'notation' )
            let patternContent = pattern.substring( 0, pattern.length - 1 )
            const given = patternContent.toLowerCase().startsWith( 'assume ' )
                       || patternContent.toLowerCase().startsWith( 'given ' )
            if ( given )
                patternContent = patternContent.substring( patternContent.indexOf( ' ' ) + 1 )
            return getConverter().then( converter => {
                const latex = converter( patternContent, notation.toLowerCase(), 'latex' )
                const html = converter( patternContent, notation.toLowerCase(), 'html' )
                const loadingMarker = 'Loading...'
                // Queue up the rendering of a typeset preview of the expression
                setTimeout( () => {
                    loadStylesheet( stylesheet ).then( () => {
                        Array.from( document.body.querySelectorAll(
                            '.tox-collection__item .tox-collection__item-label' )
                        ).filter( element =>
                            element.innerHTML == loadingMarker
                        ).forEach( element => {
                            htmlToImage( html ).then( image => {
                                element.innerHTML = ''
                                element.appendChild( image )
                            } ).catch( _ => {
                                element.innerHTML = 'Could not create preview.'
                            } )
                        } )
                    } )
                }, 0 )
                // Return a single autocompletion, with a "Loading..." marker
                // in it that will get replaced by the typeset preview soon
                return [
                    {
                        type : 'cardmenuitem',
                        value : expressionHTML( latex, given, editor ),
                        label : loadingMarker,
                        items : [
                            {
                                type : 'cardtext',
                                text : loadingMarker
                            }
                        ]
                    }
                ]
            } )
        }
    } )
    // Third, the autocompleter that is for declarations:
    editor.ui.registry.addAutocompleter( 'lurch-declaration-autocomplete', {
        trigger : '$',
        minChars : 2,
        columns : 1,
        onAction : ( autocompleter, range, newContent ) => {
            editor.selection.setRng( range )
            editor.insertContent( newContent )
            autocompleter.hide()
        },
        fetch : pattern => {
            let exprCode = pattern.replaceAll( '\\\\', '' ).replaceAll( '\\$', '' )
            const result = [ ]
            DeclarationType.allInSettings( true ).forEach( declType => {
                const symbol = declType.match( exprCode )
                if ( symbol ) {
                    const display = declType.displayForm( symbol )
                    const html = declarationHTML( declType, symbol, editor )
                    result.push( {
                        type : 'cardmenuitem',
                        value : html,
                        label : display,
                        items : [
                            { type : 'cardtext', text : display }
                        ]
                    } )
                }
            } )
            return Promise.resolve( result )
        }
    } )
}

export default { install }
