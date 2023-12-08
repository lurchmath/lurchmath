
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
    Dialog, TextInputItem, SelectBoxItem, HTMLItem, AlertItem, ButtonItem
} from './dialog.js'
import {
    parse, names as notationNames, usesMathEditor, represent, syntaxTreeHTML
} from './notation.js'
import { escapeHTML } from './utilities.js'
import { phrasesInForceAt } from './math-phrases.js'
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
    paramNames.forEach( param => atom.setMetadata( `notation-${param}`, 'putdown' ) )
    atom.update( phrase )
    return atom.getHTML()
}

// Utility functions used in the edit handler defined below.
// These are not documented here because they are small tools for internal use.
// This one is for creating input controls for either plain text or WYSIWYG math.
const inputControl = ( name, notation, label, placeholder ) =>
    usesMathEditor( notation ) ? new MathItem( name, label )
                               : new TextInputItem( name, label, placeholder || name )
// Control for choosing a notation
const notationSelect = ( name, label, accessiblePhrases = [ ] ) =>
    new SelectBoxItem( name, label, [
        ...notationNames(),
        ...accessiblePhrases.map( phrase => phrase.getMetadata( 'name' ) )
    ] )
// Common button across all types of dialogs
// Shows a simple HTML preview of the internal LC structure of the atom
const addPreviewButton = ( dialog, atom ) => {
    dialog.addItem( new ButtonItem( 'View meaning structure', () => {
        const previewDialog = new Dialog( 'View meaning structure', dialog.editor )
        previewDialog.addItem( new HTMLItem(
            `<div class="LC-meaning-preview">
                ${ atom.toLCs().map( syntaxTreeHTML ).join( '\n' ) }
            </div>`
        ) )
        previewDialog.show()
    } ) )
}
// This one sets up a dialog for editing an atom using some notation, like putdown.
const setUpNotationDialog = ( dialog, atom, initialData ) => {
    dialog.addItem( inputControl( 'code', initialData.notation, 'Expression' ) )
    addPreviewButton( dialog, atom )
    dialog.setInitialData( {
        code : atom.getMetadata( 'code' ),
        ...initialData
    } )
    if ( initialData.notation == 'math editor' )
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
const setUpPhraseDialog = ( dialog, atom, phrase, initialData ) => {
    const html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
    const internal = phrase.getMetadata( 'codeTemplate' )
    const internalNotation = phrase.getMetadata( 'notation' )
    dialog.addItem( new HTMLItem( `
        <div style='margin-top: 1em; margin-bottom: 1em;'>
            <p>External representation: ${html}</p>
            <p>Internal representation (in ${internalNotation}):
                ${escapeHTML(internal)}</p>
        </div>
    ` ) )
    const params = phrase.getMetadata( 'paramNames' ).split( ',' )
        .map( name => name.trim() )
    params.forEach( param => {
        const notationKey = `notation-${param}`
        dialog.addItem( notationSelect( notationKey, `Notation for ${param}` ) )
        initialData[notationKey] ||= internalNotation
        const valueKey = `param-${param}`
        dialog.addItem( inputControl(
            valueKey, initialData[notationKey], `Value of ${param}`, param ) )
        initialData[valueKey] = atom.getMetadata( valueKey ) || param
    } )
    if ( params.length > 0 )
        dialog.setDefaultFocus( `param-${params[0]}` )
    else
        dialog.setDefaultFocus( 'notation' )
    addPreviewButton( dialog, atom )
    dialog.setInitialData( initialData )
}
// This one takes a dialog like the one set up above and saves its edits into the atom.
const applyPhraseDialog = ( dialog, atom, phrase ) => {
    const params = phrase.getMetadata( 'paramNames' ).split( ',' )
        .map( name => name.trim() )
    params.forEach( param => {
        const notationKey = `notation-${param}`
        atom.setMetadata( notationKey, dialog.get( notationKey ) )
        const valueKey = `param-${param}`
        atom.setMetadata( valueKey, dialog.get( valueKey ) )
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
        let dataToPreserve = { notation : this.getMetadata( 'notation' ) }
        this.getMetadataKeys().map( key => {
            if ( key.startsWith( 'notation-' ) )
                dataToPreserve[key] = this.getMetadata( key )
        } )
        // define a re-usable function for setting up the dialog, because we may
        // need to run this function multiple times, if the user chooses to
        // change the type of expression being edited, in the notation drop-down
        const setUpDialog = () => {
            // clear all
            while ( dialog.items.length > 0 ) dialog.removeItem( 0 )
            // add the dropdown that's always present
            dialog.addItem( notationSelect(
                'notation', 'Type of expression', accessiblePhrases ) )
            // if it's just text in some notation, set up the dialog for that
            if ( notationNames().includes( dataToPreserve.notation ) ) {
                setUpNotationDialog( dialog, this, dataToPreserve )
                return
            }
            // if it's a math phrase, set up the dialog for that, after we
            // ensure it exists (showing an error if it doesn't)
            const phrase = nameToPhrase( dataToPreserve.notation )
            if ( !phrase ) {
                dialog.addItem( new AlertItem( 'error',
                    `Invalid type: ${dataToPreserve.notation}` ) )
                return
            }
            setUpPhraseDialog( dialog, this, phrase, dataToPreserve )
        }
        // If the user changes the type of expression being edited, we need to
        // set up the dialog again to match the new type of expression.
        dialog.onChange = ( _, component ) => {
            if ( component.name != 'notation'
              && !component.name.startsWith( 'notation-' ) )
                return
            Object.keys( dataToPreserve ).forEach( key =>
                dataToPreserve[key] = dialog.get( key ) )
            setUpDialog()
            dialog.reload()
        }
        // Set the dialog up for the first time.
        setUpDialog()
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // store any data we want to preserve
            Object.keys( dataToPreserve ).forEach( key =>
                this.setMetadata( key, dataToPreserve[key] ) )
            // if it's just text in some notation, save in the appropriate manner
            if ( notationNames().includes( dataToPreserve.notation ) ) {
                applyNotationDialog( dialog, this )
                return true
            }
            // if it's a math phrase, ensure it exists (throwing an error if it
            // doesn't) and then save in a manner suitable to all its parameters
            const phrase = nameToPhrase( dataToPreserve.notation )
            if ( !phrase )
                throw new Error( `No such math phrase: ${dataToPreserve.notation}` )
            applyPhraseDialog( dialog, this, phrase )
            return true
        } )
    },
    toLCs : function () {
        // Ensure this expression wants to be included in the output
        const code = this.getMetadata( 'code' )
        const notation = this.getMetadata( 'notation' )
        if ( !notation ) {
            console.log( 'No notation for this atom:', this )
            return [ ]
        }
        // If this expression is just plain code, parse it and return the result
        const phrase = phrasesInForceAt( this ).find(
            phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) {
            if ( !code ) {
                console.log( 'No code for this non-phrase atom:', this )
                return [ ]
            }
            const result = parse( code, notation )
            if ( result.message ) {
                console.log( code, notation, result )
                console.log( converter( code, 'latex', 'putdown' ) )
                return [ ]
            }
            return result
        }
        // If this expression is a math phrase, build it from its parameters
        const template = phrase.getMetadata( 'codeTemplate' )
        const internalNotation = phrase.getMetadata( 'notation' )
        const builtTemplate = parse( template, internalNotation )
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                const notation = this.getMetadata( `notation-${param}` )
                let builtParam = parse( value, notation )
                if ( builtParam.message || builtParam.length != 1 ) {
                    console.log( value, notation, buildParam )
                    return [ ]
                }
                builtTemplate.forEach( ( LC, index ) => {
                    const dummies = LC.descendantsSatisfying( d =>
                        d.constructor.className == 'Symbol' && d.text() == param )
                    dummies.forEach( d => {
                        const replacement = builtParam[0].copy()
                        const attributeHolder = d.copy()
                        attributeHolder.clearAttributes( 'symbol text' )
                        replacement.copyAttributesFrom( attributeHolder )
                        if ( d == LC )
                            builtTemplate[index] = replacement
                        else
                            d.replaceWith( replacement )
                    } )
                } )
            }
        } )
        return builtTemplate
    },
    toNotation : function ( notation ) {
        if ( !converter ) return
        const LCs = this.toLCs()
        let putdown = ''
        LCs.forEach( LC => putdown += LC.toPutdown() + '\n' )
        return converter( putdown, 'putdown', notation )
    },
    // this update function can optionally accept a "phrase" parameter, which
    // will prevent us from searching for a math phrase in force at this atom;
    // this is useful for constructing HTML of phrases that aren't actually in
    // the document, so technically nothing is "in force" at their location.
    update : function ( phrase ) {
        const notation = this.getMetadata( 'notation' )
        if ( !phrase )
            phrase = phrasesInForceAt( this ).find(
                phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) {
            const code = this.getMetadata( 'code' )
            const repr = `${represent( code, notation )}`
            this.fillChild( 'body', repr )
            return
        }
        let html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                const paramNotation = this.getMetadata( `notation-${param}` )
                html = html.replaceAll( param, represent( value, paramNotation ) )
            }
        } )
        this.fillChild( 'body', html )
    }
} )

export default { install }
