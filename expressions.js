
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
import { parse, names as notationNames } from './notation.js'
import { LogicConcept }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

// Internal use only.  Given an expression-type atom, updates its HTML code so
// that the appearance of the atom is its code/notation, in fixed-width font.
const updateAppearance = expressionAtom => {
    expressionAtom.fillChild( 'body',
        `${expressionAtom.getMetadata( 'code' )}` )
}

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
                code : 'expression',
                // use the notation language specified in the document settings:
                notation : lookup( editor, 'notation' )
            } )
            updateAppearance( atom )
            editor.insertContent( atom.getHTML() )
        }
    } )
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'notation', clickedAtom => {
    const dialog = clickedAtom.editor.windowManager.open( {
        title : 'Edit expression',
        body : {
            type : 'panel',
            items : [
                {
                    type : 'selectbox',
                    name : 'notation',
                    label : 'Choose the notation in which you will write:',
                    items : notationNames().map( name => {
                        return { value : name, text : name }
                    } )
                },
                {
                    type : 'input',
                    name : 'code',
                    label : 'Code for expression or declaration in that notation:'
                },
                {
                    type : 'htmlpanel',
                    html : '<span id="notation-feedback"></span>'
                }
            ]
        },
        buttons : [
            {
                text : 'Save',
                type : 'submit',
                name : 'save',
                buttonType : 'primary'
            },
            {
                text : 'Cancel',
                type : 'cancel',
                name : 'cancel'
            }
        ],
        initialData : {
            code : clickedAtom.getMetadata( 'code' ),
            notation : clickedAtom.getMetadata( 'notation' )
        },
        onChange : dialog => {
            const code = dialog.getData()['code']
            const lang = dialog.getData()['notation']
            const result = parse( code, lang )
            if ( result instanceof LogicConcept ) {
                document.body.querySelector( '#notation-feedback' )
                    .innerHTML = ''
                dialog.setEnabled( 'save', true )
            } else {
                document.body.querySelector( '#notation-feedback' )
                    .innerHTML = result.message
                if ( result.hasOwnProperty( 'position' ) )
                    document.body.querySelector( '#notation-feedback' )
                        .innerHTML += `<br>Error is at position ${result.position}.`
                dialog.setEnabled( 'save', false )
            }
        },
        onSubmit : () => {
            clickedAtom.setMetadata( 'code', dialog.getData()['code'] )
            clickedAtom.setMetadata( 'notation', dialog.getData()['notation'] )
            updateAppearance( clickedAtom )
            dialog.close()
        }
    } )
    setTimeout( () => dialog.focus( 'code' ), 0 )
} )

export default { install }
