
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting an inline atom into the document, one that allows the user to write
 * mathematical expressions using any of the parsers defined in the
 * {@link module:Notation notation module}.
 * 
 * @module NotationAtoms
 */

import { Atom } from './atoms.js'
import { appSettings } from './settings-install.js'
import { Dialog, TextInputItem, HTMLItem, ButtonItem } from './dialog.js'
import { parse, represent, syntaxTreeHTML } from './notation.js'
import { MathItem, getConverter } from './math-live.js'

let converter = null

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
    getConverter().then( result => converter = result )
    editor.ui.registry.addMenuItem( 'expression', {
        text : 'Expression',
        icon : 'insert-character',
        tooltip : 'Insert math in simple notation',
        shortcut : 'Meta+E',
        onAction : () => {
            const atom = Atom.newInline( editor, '', {
                type : 'notation',
                asciimath : '',
                latex : ''
            } )
            atom.update()
            atom.editThenInsert()
        }
    } )
}

/**
 * Create the HTML for an expression atom with the given content and notation.
 * This type of expression atom is written in the given notation.
 * 
 * @param {string} content - the content of the expression, written in the
 *   notation named in the second argument
 * @param {string} notation - the name of the notation that should be used
 *   (e.g., putdown or smackdown)
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which the
 *   expression may eventually be inserted (used primarily for constructing
 *   HTML elements using its document object)
 * @function
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

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'notation', {
    edit : function () {
        // set up dialog contents
        const dialog = new Dialog( 'Edit expression', this.editor )
        const asciiMathInput = new TextInputItem( 'asciimath', 'In plain text', '' )
        dialog.addItem( asciiMathInput )
        const mathLiveInput = new MathItem( 'latex', 'In standard notation' )
        dialog.addItem( mathLiveInput )
        dialog.addItem( new ButtonItem( 'View meaning', () => {
            const previewDialog = new Dialog( 'View meaning', dialog.editor )
            previewDialog.addItem( new HTMLItem(
                `<div class="LC-meaning-preview">
                    ${ this.toLCs().map( syntaxTreeHTML ).join( '\n' ) }
                </div>`
            ) )
            previewDialog.show()
        } ) )
        // initialize dialog with data from the atom
        dialog.setInitialData( {
            asciimath : this.getMetadata( 'asciimath' ),
            latex : this.getMetadata( 'latex' )
        } )
        dialog.setDefaultFocus( appSettings.get( 'notation' ).toLowerCase() )
        // if the edit asciimath or latex, keep them in sync
        dialog.onChange = ( _, component ) => {
            if ( component.name == 'asciimath' ) {
                const asciiMath = dialog.get( 'asciimath' )
                const latex = converter( asciiMath, 'asciimath', 'latex' )
                mathLiveInput.setValue( latex )
            } else if ( component.name == 'latex' ) {
                const latex = dialog.get( 'latex' )
                const asciiMath = converter( latex, 'latex', 'asciimath' )
                dialog.dialog.setData( { asciimath : asciiMath } )
            }
        }
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // save the data
            this.setMetadata( 'asciimath', dialog.get( 'asciimath' ) )
            this.setMetadata( 'latex', dialog.get( 'latex' ) )
            this.update()
            return true
        } )
    },
    toLCs : function () {
        // Get the LaTeX form and attempt to parse it
        const latex = this.getMetadata( 'latex' )
        const result = parse( latex, 'latex' )
        // If there was no error, we can return the result
        if ( !result.message ) return result
        // There was an error, so log it and return no LCs
        console.log( latex, 'latex', result )
        console.log( converter( latex, 'latex', 'putdown' ) )
        return [ ]
    },
    toNotation : function ( notation ) {
        if ( !converter ) return
        const LCs = this.toLCs()
        let putdown = ''
        LCs.forEach( LC => putdown += LC.toPutdown() + '\n' )
        return converter( putdown, 'putdown', notation )
    },
    update : function () {
        const latex = this.getMetadata( 'latex' )
        const repr = `${represent( latex, 'latex' )}`
        this.fillChild( 'body', repr )
    }
} )

export default { install }
