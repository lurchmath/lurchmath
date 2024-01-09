
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting an inline atom into the document, one that allows the user to write
 * mathematical expressions in either Lurch notation or LaTeX notation using a
 * MathLive equation editor.
 * 
 * @module ExpressionAtoms
 */

import { Atom } from './atoms.js'
import { lookup } from './document-settings.js'
import { Dialog, TextInputItem, HTMLItem, ButtonItem, CheckBoxItem } from './dialog.js'
import { parse, represent, syntaxTreeHTML } from './notation.js'
import { MathItem, getConverter } from './math-live.js'
import { appSettings } from './settings-install.js'

let converter = null

/**
 * Install into a TinyMCE editor instance a new menu item:
 * "Expression," intended for the Insert menu.  It creates an inline atom that
 * can be inserted into the user's document, then initiates editing on it, so
 * that the user can customize it and then confirm or cancel the insertion of it.
 * The inline atom represents a mathematical expression.
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
        tooltip : 'Insert expression',
        shortcut : 'Meta+E',
        onAction : () => {
            const atom = Atom.newInline( editor, '', {
                type : 'expression',
                lurchNotation : '',
                latex : '',
                given : false
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
export const expressionHTML = ( latex, given, editor ) => {
    const atom = Atom.newInline( editor, '', {
        type : 'expression',
        lurchNotation : converter( latex, 'latex', 'lurch' ),
        latex : latex,
        given : given
    } )
    atom.update()
    return atom.getHTML()
}

// Internal use only: Show the dialog whose behavior is described above.
export class Expression extends Atom {

    static subclassName = Atom.registerSubclass( 'expression', Expression )

    /**
     * Shows a multi-part dialog for editing expression atoms using Lurch
     * notation or a MathLive editor widget.  The user can then confirm or
     * cancel the edit, as per the convention described in
     * {@link module:Atoms.Atom#edit the edit() function for the Atom class}.
     * 
     * @returns {Promise} same convention as specified in
     *   {@link module:Atoms.Atom#edit edit() for Atoms}
     */
    edit () {
        // set up dialog contents
        const dialog = new Dialog( 'Edit expression', this.editor )
        const lurchInput = new TextInputItem( 'lurchNotation', 'In plain text', '' )
        dialog.addItem( lurchInput )
        const mathLiveInput = new MathItem( 'latex', 'In standard notation' )
        dialog.addItem( mathLiveInput )
        dialog.addItem( new CheckBoxItem( 'given', 'Is the expression given?', false ) )
        if ( appSettings.get( 'show view meaning button' ) ) {
            dialog.addItem( new ButtonItem( 'View meaning', () => {
                const previewDialog = new Dialog( 'View meaning', dialog.editor )
                const copy = Atom.newInline( this.editor, '', {
                    type : 'expression',
                    lurchNotation : dialog.get( 'lurchNotation' ),
                    latex : dialog.get( 'latex' ),
                    given : dialog.get( 'given' )
                } )
                copy.update()
                previewDialog.addItem( new HTMLItem(
                    `<div class="LC-meaning-preview">
                        ${ copy.toLCs().map( syntaxTreeHTML ).join( '\n' ) }
                    </div>`
                ) )
                previewDialog.show()
            } ) )
        }
        // initialize dialog with data from the atom
        dialog.setInitialData( {
            lurchNotation : this.getMetadata( 'lurchNotation' ),
            latex : this.getMetadata( 'latex' ),
            given : this.getMetadata( 'given' )
        } )
        dialog.setDefaultFocus( lookup( this.editor, 'notation' ).toLowerCase() )
        // if they edit the Lurch notation or latex, keep them in sync
        let syncEnabled = false
        setTimeout( () => syncEnabled = true, 0 ) // after dialog populates
        dialog.onChange = ( _, component ) => {
            if ( !syncEnabled ) return
            syncEnabled = false // prevent syncing to fixed point/infinity
            if ( component.name == 'lurchNotation' ) {
                const lurchNotation = dialog.get( 'lurchNotation' )
                try {
                    const latex = converter( lurchNotation, 'lurch', 'latex' )
                    mathLiveInput.setValue( latex )
                    // console.log( '\nLurch input contains:', lurchNotation )
                    // console.log( 'Corresponding LaTeX:', latex )
                } catch ( e ) {
                    console.log( 'Could not convert Lurch notation to LaTeX:', lurchNotation )
                    // console.log( e )
                }
            } else if ( component.name == 'latex' ) {
                const latex = dialog.get( 'latex' )
                try {
                    const lurchNotation = converter( latex, 'latex', 'lurch' )
                    dialog.dialog.setData( { lurchNotation : lurchNotation } )
                    // console.log( '\nMathLive widget contains:', latex )
                    // console.log( 'Can it parse that?',
                    //     JSON.stringify( MathfieldElement.computeEngine.parse( latex,
                    //         { canonical : false } ).json ) )
                    // console.log( 'Can we convert it to putdown?',
                    //     converter( latex, 'latex', 'putdown' ) )
                    // const tmp = parse( latex, 'latex' )
                    // console.log( 'Is the putdown valid?', tmp.message || 'yes' )
                } catch ( e ) {
                    console.log( 'Could not convert LaTeX to Lurch notation:', latex )
                    // console.log( e )
                }
            }
            syncEnabled = true
        }
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // save the data
            this.setMetadata( 'lurchNotation', dialog.get( 'lurchNotation' ) )
            this.setMetadata( 'latex', dialog.get( 'latex' ) )
            this.setMetadata( 'given', dialog.get( 'given' ) )
            this.update()
            return true
        } )
    }

    /**
     * If this expression successfully parses into a single LogicConcept, then
     * this function returns a JavaScript array containing that one LogicConcept.
     * Otherwise, this function returns an empty array, and has the side effect
     * of printing errors to the developer console to assist with debugging.
     * 
     * @returns {LogicConcept[]} an array containing zero or one LogicConcepts
     */
    toLCs () {
        // Get the Lurch form and attempt to parse it
        const lurchNotation = this.getMetadata( 'lurchNotation' )
        const result = parse( lurchNotation, 'lurchNotation' )
        // If there was an error, log it and return no LCs
        if ( result.message ) {
            console.log( lurchNotation, 'lurchNotation', result )
            console.log( converter( lurchNotation, 'lurch', 'putdown' ) )
            return [ ]
        }
        // If there was more than one LC created, complain and return no LCs
        if ( result.length != 1 ) {
            console.log( 'Expression yielded more than one LC:' )
            console.log( result.map( LC => LC.toPutdown() ) )
            return [ ]
        }
        // Mark the one LC as a given or claim and return it (in a list)
        if ( this.getMetadata( 'given' ) )
            result[0].makeIntoA( 'given' )
        else
            result[0].unmakeIntoA( 'given' )
        return result
    }

    /**
     * Update the HTML representation of this expression.  That includes placing
     * a typeset version of the expression into the atom's body and setting the
     * prefix to be `'Assume '` if the expression is given, otherwise empty.
     */
    update () {
        const lurchNotation = this.getMetadata( 'lurchNotation' )
        const repr = `${represent( lurchNotation, 'lurchNotation' )}`
        this.fillChild( 'body', repr )
        if ( this.getMetadata( 'given' ) )
            this.fillChild( 'prefix', 'Assume ' )
        else
            this.fillChild( 'prefix', '' )
    }

}

export default { install }
