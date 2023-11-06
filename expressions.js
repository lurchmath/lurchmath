
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting an inline atom into the document, one that allows the user to write
 * mathematical expressions using any of the parsers defined in the
 * {@link module:Notation notation module}.
 * 
 * @module NotationAtoms
 */

import { Atom } from './atoms.js'
import { Shell } from './shells.js'
import { lookup } from './document-settings.js'
import { Dialog, TextInputItem, SelectBoxItem, HTMLItem, AlertItem } from './dialog.js'
import { parse, names as notationNames } from './notation.js'
import { escapeHTML } from './utilities.js'
import { LogicConcept } from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

// Internal use only.  Given an atom, find all accessible math phrase definitions.
const phraseDefsAccessibleTo = atom => {
    const result = [ ]
    Shell.accessibles( atom.editor, atom.element ).forEach(
        atomElement => {
            const atom = new Atom( atomElement )
            if ( atom.getMetadata( 'type' ) == 'mathphrasedef' )
                result.push( atom )
        }
    )
    return result
}

// Internal use only.  Given an expression-type atom, updates its HTML code so
// that the appearance of the atom is its code/notation, in fixed-width font.
const updateAppearance = expressionAtom => {
    const notation = expressionAtom.getMetadata( 'notation' )
    const phrase = phraseDefsAccessibleTo( expressionAtom ).find(
        phrase => phrase.getMetadata( 'name' ) == notation )
    if ( !phrase ) {
        expressionAtom.fillChild( 'body',
            `${expressionAtom.getMetadata( 'code' )}` )
        return
    }
    let html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
    expressionAtom.getMetadataKeys().forEach( key => {
        if ( key.startsWith( 'param-' ) ) {
            const param = key.substring( 6 )
            const value = expressionAtom.getMetadata( key )
            while ( html.indexOf( param ) >= 0 )
                html = html.replace( param, escapeHTML( value ) )
        }
    } )
    expressionAtom.fillChild( 'body', html )
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
            // Insert the atom and immediately begin editing it.
            atom.insertAndReturnCopy( editor ).edit?.()
        }
    } )
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'notation', {
    edit : function () {
        const dialog = new Dialog( 'Edit expression', this.editor )
        const accessiblePhrases = phraseDefsAccessibleTo( this )
        const notationsAndPhrases = [
            ...notationNames().map( name => `${name} expression` ),
            ...accessiblePhrases.map( phrase => phrase.getMetadata( 'name' ) )
        ]
        let notation = this.getMetadata( 'notation' )
        const setUpDialog = () => {
            while ( dialog.items.length > 0 )
                dialog.removeItem( 0 )
            dialog.addItem( new SelectBoxItem(
                'notation', 'Type of expression', notationsAndPhrases ) )
            dialog.onChange = ( _, component ) => {
                if ( component.name != 'notation' ) return
                notation = dialog.get( 'notation' )
                setUpDialog()
                dialog.reload()
            }
            if ( notationNames().includes( notation ) ) {
                dialog.addItem( new TextInputItem( 'code', 'Code for expression' ) )
                dialog.setInitialData( {
                    code : this.getMetadata( 'code' ),
                    notation : this.getMetadata( 'notation' )
                } )    
                return
            }
            const phrase = accessiblePhrases.find(
                phrase => phrase.getMetadata( 'name' ) == notation )
            if ( !phrase ) {
                dialog.addItem( new AlertItem( 'error', `Invalid type: ${notation}` ) )
                return
            }
            const html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
            const internal = phrase.getMetadata( 'codeTemplate' )
            const paramNotation = phrase.getMetadata( 'notation' )
            dialog.addItem( new HTMLItem( `
                <div style='margin-top: 1em; margin-bottom: 1em;'>
                    <p>External representation: ${html}</p>
                    <p>Internal representation (in ${paramNotation}):
                        ${escapeHTML(internal)}</p>
                </div>
            ` ) )
            const initialData = { notation }
            const params = phrase.getMetadata( 'paramNames' ).split( ',' )
                .map( name => name.trim() )
            params.forEach( param => {
                const key = `param-${param}`
                dialog.addItem( new TextInputItem( key,
                    `${param} (written in ${paramNotation})`, param ) )
                initialData[key] = this.getMetadata( key ) || ''
            } )
            dialog.setInitialData( initialData )
        }
        setUpDialog()
        dialog.show().then( userHitOK => {
            if ( !userHitOK ) return
            this.setMetadata( 'notation', notation )
            if ( notationNames().includes( notation ) ) {
                this.setMetadata( 'code', dialog.get( 'code' ) )
                updateAppearance( this )
                return
            }
            const phrase = accessiblePhrases.find(
                phrase => phrase.getMetadata( 'name' ) == notation )
            if ( !phrase ) return
            const params = phrase.getMetadata( 'paramNames' ).split( ',' )
                .map( name => name.trim() )
            params.forEach( param => {
                const key = `param-${param}`
                this.setMetadata( key, dialog.get( key ) )
            } )
            updateAppearance( this )
        } )
    },
    toLCs : function () {
        // Ensure this expression wants to be included in the output
        const code = this.getMetadata( 'code' )
        const notation = this.getMetadata( 'notation' )
        if ( !code || !notation ) return [ ]
        // If this expression is just plain code, parse it and return the result
        const phrase = phraseDefsAccessibleTo( this ).find(
            phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) {
            const result = parse( code, notation )
            if ( !( result instanceof LogicConcept ) )
                throw new Error( result.message )
            return [ result ]
        }
        // If this expression is a math phrase, build its code and parse that
        let template = phrase.getMetadata( 'codeTemplate' )
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                while ( template.indexOf( param ) >= 0 )
                    template = template.replace( param, value )
            }
        } )
        const paramNotation = phrase.getMetadata( 'notation' )
        if ( ![ 'putdown', 'smackdown' ].includes( paramNotation ) )
            throw new Error( `Invalid notation: ${paramNotation}` )
        return paramNotation == 'putdown' ?
            LogicConcept.fromPutdown( template ) :
            LogicConcept.fromSmackdown( template )
    }
} )

export default { install }
