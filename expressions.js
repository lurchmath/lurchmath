
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
import { Expression as LCExpression }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

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

    // Internal use only.
    // Used by edit() if the user's settings are in beginner mode.
    editInBeginnerMode () {
        // If the Lurch notation is not for a single expression, we must use
        // advanced mode.
        const LCs = this.toLCs()
        if ( ( LCs.length > 1 ) ||
             ( ( LCs.length == 1 ) && !( LCs[0] instanceof LCExpression ) ) ) {
            return new Promise( ( resolve, reject ) => {
                Dialog.failure(
                    this.editor,
                    'This content can be edited only in advanced mode.  '
                  + 'Redirecting you to advanced mode.',
                    'Content too complex'
                ).then( () =>
                    this.editInAdvancedMode().then( resolve ).catch( reject )
                )
            } )
        }
        // Otherwise, just redirect to intermediate mode, because beginner mode
        // is not yet implemented.  (We will fix that later.)
        return new Promise( ( resolve, reject ) => {
            Dialog.failure(
                this.editor,
                'Beginner mode is not yet implemented.  Redirecting you to intermediate mode.',
                'Not yet implemented'
            ).then( () =>
                this.editInIntermediateMode().then( resolve ).catch( reject )
            )
        } )
    }

    // Internal use only.
    // Used by edit() if the user's settings are in intermediate mode.
    editInIntermediateMode () {
        // If the Lurch notation is not for a single expression, we must use
        // advanced mode.
        const LCs = this.toLCs()
        if ( ( LCs.length > 1 ) ||
             ( ( LCs.length == 1 ) && !( LCs[0] instanceof LCExpression ) ) ) {
            return new Promise( ( resolve, reject ) => {
                Dialog.failure(
                    this.editor,
                    'This content can be edited only in advanced mode.  '
                  + 'Redirecting you to advanced mode.',
                    'Content too complex'
                ).then( () =>
                    this.editInAdvancedMode().then( resolve ).catch( reject )
                )
            } )
        }
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
                previewDialog.removeButton( 'Cancel' )
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
        // utilities used below
        const convertLatex = () => {
            try {
                return converter( dialog.get( 'lurchNotation' ), 'lurch', 'latex' )
            } catch {
                return null
            }
        }
        const convertLurchNotation = () => {
            try {
                return converter( dialog.get( 'latex' ), 'latex', 'lurch' )
            } catch {
                return null
            }
        }
        // if they edit the Lurch notation or latex, keep them in sync
        let syncEnabled = false
        setTimeout( () => syncEnabled = true, 0 ) // after dialog populates
        dialog.onChange = ( _, component ) => {
            if ( !syncEnabled ) return
            syncEnabled = false // prevent syncing to fixed point/infinity
            if ( component.name == 'lurchNotation' ) {
                const converted = convertLatex()
                if ( converted )
                    mathLiveInput.setValue( converted )
                dialog.dialog.setEnabled( 'OK', !!converted )
            } else if ( component.name == 'latex' ) {
                const converted = convertLurchNotation()
                if ( converted )
                    dialog.dialog.setData( { lurchNotation : converted } )
                dialog.dialog.setEnabled( 'OK', !!converted )
            }
            syncEnabled = true
        }
        // Show it and if they accept any changes, apply them to the atom.
        const result = dialog.show().then( userHitOK => {
            if ( !userHitOK || !convertLatex() ) return false
            // save the data
            this.setMetadata( 'lurchNotation', dialog.get( 'lurchNotation' ) )
            this.setMetadata( 'latex', dialog.get( 'latex' ) )
            this.setMetadata( 'given', dialog.get( 'given' ) )
            this.update()
            return true
        } )
        dialog.dialog.setEnabled( 'OK', !!convertLatex() )
        return result
    }

    // Internal use only.
    // Used by edit() if the user's settings are in advanced mode.
    editInAdvancedMode () {
        // set up dialog contents
        const dialog = new Dialog( 'Edit expression', this.editor )
        dialog.hideHeader = dialog.hideFooter = true
        const lurchInput = new TextInputItem( 'lurchNotation', '', '' )
        dialog.addItem( lurchInput )
        const mathLiveInput = new MathItem( 'latex', '' )
        mathLiveInput.finishSetup = () => {
            mathLiveInput.mathLiveEditor.readOnly = true
            mathLiveInput.mathLiveEditor.style.border = 0
        }
        dialog.addItem( mathLiveInput )
        if ( appSettings.get( 'show view meaning button' ) ) {
            dialog.addItem( new ButtonItem( 'View meaning', () => {
                const previewDialog = new Dialog( 'View meaning', dialog.editor )
                previewDialog.removeButton( 'Cancel' )
                const copy = Atom.newInline( this.editor, '', {
                    type : 'expression',
                    lurchNotation : dialog.get( 'lurchNotation' ),
                    latex : dialog.get( 'latex' )
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
            latex : this.getMetadata( 'latex' )
        } )
        dialog.setDefaultFocus( lookup( this.editor, 'notation' ).toLowerCase() )
        // utility used below
        const convertLatex = () => {
            try {
                return converter( dialog.get( 'lurchNotation' ), 'lurch', 'latex' )
            } catch {
                return null
            }
        }
        // if they edit the Lurch notation or latex, keep them in sync
        dialog.onChange = ( _, component ) => {
            if ( component.name == 'lurchNotation' ) {
                const converted = convertLatex()
                if ( converted )
                    mathLiveInput.setValue( converted )
                dialog.dialog.setEnabled( 'OK', !!converted )
            }
        }
        // Show it and if they accept any changes, apply them to the atom.
        const result = dialog.show().then( userHitOK => {
            if ( !userHitOK || !convertLatex() ) return false
            // save the data
            this.setMetadata( 'lurchNotation', dialog.get( 'lurchNotation' ) )
            this.setMetadata( 'latex', dialog.get( 'latex' ) )
            const LCs = this.toLCs()
            this.setMetadata( 'given', LCs.length == 1 && LCs[0].isA( 'given' ) )
            this.update()
            return true
        } )
        dialog.dialog.setEnabled( 'OK', !!convertLatex() )
        return result
    }

    /**
     * Shows a dialog for editing an expression atom, but it may show one of
     * three different dialogs, depending on whether the user has chosen
     * beginner, intermediate, or advanced mode in their settings.
     * 
     * **Beginner mode does this:**
     * 
     * (It is not yet implemented.  Check back later.)
     * 
     * **Intermediate mode does this:**
     * 
     * Shows a multi-part dialog for editing expression atoms using Lurch
     * notation or a MathLive editor widget.  The user can then confirm or
     * cancel the edit, as per the convention described in
     * {@link module:Atoms.Atom#edit the edit() function for the Atom class}.
     * 
     * **Advanced mode does this:**
     * 
     * The dialog is extremely minimalist, no title bar, no footer buttons, no
     * miniature headings over each input/output, and the only input is the
     * Lurch notation.  The MathLive widget is a read-only preview.  There is no
     * checkbox for given/claim status, but that status is inferred from the
     * Lurch notation.
     * 
     * @returns {Promise} same convention as specified in
     *   {@link module:Atoms.Atom#edit edit() for Atoms}
     */
    edit () {
        switch ( appSettings.get( 'expression editor type' ) ) {
            case 'Beginner':
                return this.editInBeginnerMode()
            case 'Intermediate':
                return this.editInIntermediateMode()
            case 'Advanced':
                return this.editInAdvancedMode()
        }
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
        // Because hackers in advanced mode may use it to create >1 LC in one
        // expression, we comment this out for now.  We may re-institute it
        // later once the application is sufficiently debugged that we don't
        // need to be doing this kind of hacking any longer.
        // if ( result.length != 1 ) {
        //     console.log( 'Expression yielded more than one LC:' )
        //     console.log( result.map( LC => LC.toPutdown() ) )
        //     return [ ]
        // }
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
