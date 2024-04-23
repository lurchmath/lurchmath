
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
 * Clients can import this module and then call its
 * {@link module:AutoComplete.install install()} function to add autocompletion
 * support to TinyMCE.
 * 
 * @module AutoComplete
 */

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
 * @function
 */
export const addAutocompleteFunction = f => autocompleteFunctions.push( f )

/**
 * Install autocompletion support in a TinyMCE Editor.  See the documentation at
 * {@link module:AutoComplete the top of this module} for details.
 * 
 * @param {tinymce.Editor} editor - the editor into which to install support for
 *   autocompletion
 * @function
 */
export const install = editor => {
    // Install the metea-autocompleter, which is extensible using the
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
}

export default { install }
