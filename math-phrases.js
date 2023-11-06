
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting a math phrase definition into the document.  A user who edits such
 * a thing (which is a block-style atom) can specify all of the following
 * attributes:
 * 
 *  * Name of the phrase
 *  * Names of its parameters
 *  * HTML representation in terms of those parameters
 *  * Representation in some other notation, also in terms of those parameters
 *  * Name of the notation in question (putdown, etc.)
 * 
 * @module MathPhrases
 */

import { Atom } from './atoms.js'
import { simpleHTMLTable, escapeHTML } from './utilities.js'
import { Dialog, TextInputItem, SelectBoxItem } from './dialog.js'

const validParamNames = text => {
    if ( /^\s*$/.test( text ) ) return true
    const paramNames = text.split( /\s*,\s*/ )
    return paramNames.every( name => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test( name ) )
}
const notationNames = [ 'putdown', 'json' ]
const validNotation = notation => notationNames.includes( notation.toLowerCase() )

// Internal use only.  Given a math phrase definition atom, updates its body
// HTML code to correctly represent it to the user, based on all of its
// parameters.
const updateAppearance = mathPhraseDefAtom => {
    mathPhraseDefAtom.element.style.border = 'solid 1px blue'
    mathPhraseDefAtom.element.style.padding = '1em'
    const name = mathPhraseDefAtom.getMetadata( 'name' )
    const paramNames = mathPhraseDefAtom.getMetadata( 'paramNames' )
    const htmlTemplate = mathPhraseDefAtom.getHTMLMetadata( 'htmlTemplate' ).innerHTML
    const codeTemplate = mathPhraseDefAtom.getMetadata( 'codeTemplate' )
    const notation = mathPhraseDefAtom.getMetadata( 'notation' )
    mathPhraseDefAtom.fillChild( 'body', simpleHTMLTable(
        'Define a new math phrase with the following properties.',
        [
            'Name:', escapeHTML( name ),
            name == '' && `Math phrase must have a name`
        ],
        [
            'Parameters:', escapeHTML( paramNames ),
            !validParamNames( paramNames ) && `Not a valid list of parameters`
        ],
        [
            'External representation (in HTML):', `<tt>${escapeHTML( htmlTemplate )}</tt>`,
            htmlTemplate == '' && `Math phrase must have an HTML representation`
        ],
        [
            'Internal representation notation:', `<tt>${escapeHTML( notation )}</tt>`,
            !validNotation( notation ) && `Not a valid notation`
        ],
        [
            'Internal representation:', `<tt>${escapeHTML( codeTemplate )}</tt>`,
            codeTemplate == '' && `Math phrase must have a code representation`
        ]
    ) )
}

/**
 * Install into a TinyMCE editor instance a new menu item: Define math phrase,
 * intended for the Document menu.  It adds a math phrase definition atom (with
 * no content) to the user's document, and if the user clicks it, they can then
 * specify its properties in a popup dialog.
 * 
 * This assumes that the TinyMCE initialization code includes the
 * "mathphrasedef" item on one of the menus.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'mathphrasedef', {
        text : 'Define math phrase',
        tooltip : 'Insert block for defining a math phrase',
        onAction : () => {
            const atom = Atom.newBlock( editor, '', {
                type : 'mathphrasedef',
                name : 'equation',
                paramNames : 'X, Y',
                codeTemplate : '(= X Y)',
                notation : 'putdown'
            } )
            atom.setHTMLMetadata( 'htmlTemplate', 'X and Y are equal' )
            updateAppearance( atom )
            // Insert the atom and immediately begin editing it.
            atom.insertAndReturnCopy( editor ).edit?.()
        }
    } )
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'mathphrasedef', {
    edit : function () {
        const dialog = new Dialog( 'Edit math phrase definition', this.editor )
        dialog.addItem( new TextInputItem( 'name', 'Name' ) )
        dialog.addItem( new TextInputItem( 'paramNames', 'Parameters' ) )
        dialog.addItem( new TextInputItem( 'htmlTemplate', 'External representation (in HTML)' ) )
        dialog.addItem( new SelectBoxItem( 'notation', 'Notation for internal representation', notationNames ) )
        dialog.addItem( new TextInputItem( 'codeTemplate', 'Internal representation' ) )
        dialog.setInitialData( {
            name : this.getMetadata( 'name' ),
            paramNames : this.getMetadata( 'paramNames' ),
            htmlTemplate : this.getHTMLMetadata( 'htmlTemplate' ).innerHTML,
            codeTemplate : this.getMetadata( 'codeTemplate' ),
            notation : this.getMetadata( 'notation' )
        } )
        dialog.show().then( userHitOK => {
            if ( !userHitOK ) return
            this.setMetadata( 'name', dialog.get( 'name' ) )
            this.setMetadata( 'paramNames', dialog.get( 'paramNames' ) )
            this.setHTMLMetadata( 'htmlTemplate', dialog.get( 'htmlTemplate' ) )
            this.setMetadata( 'codeTemplate', dialog.get( 'codeTemplate' ) )
            this.setMetadata( 'notation', dialog.get( 'notation' ) )
            updateAppearance( this )
        } )
    }
} )

export default { install }
