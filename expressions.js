
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
import {
    Dialog, TextInputItem, SelectBoxItem, HTMLItem, ButtonItem
} from './dialog.js'
import {
    parse, names as notationNames, usesMathEditor, represent, syntaxTreeHTML
} from './notation.js'
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
                code : '',
                notation : appSettings.get( 'notation' )
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
        // get all relevant data from the atom and the document
        const dialog = new Dialog( 'Edit expression', this.editor )
        let dataToPreserve = { notation : this.getMetadata( 'notation' ) }
        this.getMetadataKeys().map( key => {
            if ( key.startsWith( 'notation-' ) )
                dataToPreserve[key] = this.getMetadata( key )
        } )
        // define a re-usable function for setting up the dialog, because if the
        // user changes to/from a math editor, the dialog will need to be updated
        // to use the math editor or a text input, depending on the user's choice
        const setUpDialog = () => {
            // first clear out old content
            while ( dialog.items.length > 0 ) dialog.removeItem( 0 )
            // now add new content
            dialog.addItem( new SelectBoxItem(
                'notation', 'Type of expression', notationNames() ) )
            dialog.addItem( usesMathEditor( dataToPreserve.notation ) ?
                new MathItem( 'code', 'Expression' ) :
                new TextInputItem( 'code', 'Expression', 'code' ) )
            dialog.addItem( new ButtonItem( 'View meaning structure', () => {
                const previewDialog = new Dialog( 'View meaning structure', dialog.editor )
                previewDialog.addItem( new HTMLItem(
                    `<div class="LC-meaning-preview">
                        ${ this.toLCs().map( syntaxTreeHTML ).join( '\n' ) }
                    </div>`
                ) )
                previewDialog.show()
            } ) )
            dialog.setInitialData( {
                code : this.getMetadata( 'code' ),
                ...dataToPreserve
            } )
            if ( dataToPreserve.notation == 'math editor' )
                dialog.items.find( item => item.name == 'code' )?.setFocusWhenShown( true )
            else
                dialog.setDefaultFocus( 'code' )
        }
        // run initial setup
        setUpDialog()
        // re-run setup if notation type changes
        dialog.onChange = ( _, component ) => {
            if ( component.name != 'notation' ) return
            Object.keys( dataToPreserve ).forEach( key =>
                dataToPreserve[key] = dialog.get( key ) )
            setUpDialog()
            dialog.reload()
        }
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // store any data we want to preserve
            Object.keys( dataToPreserve ).forEach( key =>
                this.setMetadata( key, dataToPreserve[key] ) )
            // save the data
            this.setMetadata( 'code', dialog.get( 'code' ) )
            this.update()
            return true
        } )
    },
    toLCs : function () {
        // If this expression has no notation type defined, we can't parse it
        const notation = this.getMetadata( 'notation' )
        if ( !notation ) {
            console.log( 'No notation for this atom:', this )
            return [ ]
        }
        // If this expression has no code stored in it, we can't parse it
        const code = this.getMetadata( 'code' )
        if ( !code ) {
            console.log( 'No code for this atom:', this )
            return [ ]
        }
        // Parse it and ensure there wasn't a parsing error
        const result = parse( code, notation )
        if ( result.message ) {
            console.log( code, notation, result )
            console.log( converter( code, 'latex', 'putdown' ) )
            return [ ]
        }
        // There were no parsing errors, so return the result
        return result
    },
    toNotation : function ( notation ) {
        if ( !converter ) return
        const LCs = this.toLCs()
        let putdown = ''
        LCs.forEach( LC => putdown += LC.toPutdown() + '\n' )
        return converter( putdown, 'putdown', notation )
    },
    update : function () {
        const notation = this.getMetadata( 'notation' )
        const code = this.getMetadata( 'code' )
        const repr = `${represent( code, notation )}`
        this.fillChild( 'body', repr )
        return
    }
} )

export default { install }
