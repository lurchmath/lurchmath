
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
import { Dialog, TextInputItem, SelectBoxItem, HTMLItem, AlertItem } from './dialog.js'
import { parse, names as notationNames } from './notation.js'
import { escapeHTML } from './utilities.js'
import { LogicConcept } from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'
import { phrasesInForceAt } from './math-phrases.js'

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
                code : '',
                // use the notation language specified in the document settings:
                notation : lookup( editor, 'notation' )
            } )
            atom.update()
            atom.editThenInsert( editor )
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
    atom.update( phrase )
    return atom.getHTML()
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'notation', {
    edit : function () {
        const dialog = new Dialog( 'Edit expression', this.editor )
        const accessiblePhrases = phrasesInForceAt( this )
        const notationsAndPhrases = [
            ...notationNames(),
            ...accessiblePhrases.map( phrase => phrase.getMetadata( 'name' ) )
        ]
        let notation = this.getMetadata( 'notation' )
        const setUpDialog = () => {
            while ( dialog.items.length > 0 )
                dialog.removeItem( 0 )
            dialog.addItem( new SelectBoxItem(
                'notation', 'Type of expression', notationsAndPhrases ) )
            if ( notationNames().includes( notation ) ) {
                dialog.addItem( new TextInputItem(
                    'code', 'Code for expression', 'expression' ) )
                dialog.setInitialData( {
                    code : this.getMetadata( 'code' ),
                    notation : notation
                } )
                dialog.setDefaultFocus( 'code' )
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
            if ( params.length > 0 )
                dialog.setDefaultFocus( `param-${params[0]}` )
            else
                dialog.setDefaultFocus( 'notation' )
            dialog.setInitialData( initialData )
        }
        dialog.onChange = ( _, component ) => {
            if ( component.name != 'notation' ) return
            notation = dialog.get( 'notation' )
            setUpDialog()
            dialog.reload()
        }
        setUpDialog()
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            this.setMetadata( 'notation', notation )
            if ( notationNames().includes( notation ) ) {
                this.setMetadata( 'code', dialog.get( 'code' ) )
                this.update()
                return true
            }
            const phrase = accessiblePhrases.find(
                phrase => phrase.getMetadata( 'name' ) == notation )
            if ( !phrase )
                throw new Error( `No such math phrase: ${notation}` )
            const params = phrase.getMetadata( 'paramNames' ).split( ',' )
                .map( name => name.trim() )
            params.forEach( param => {
                const key = `param-${param}`
                this.setMetadata( key, dialog.get( key ) )
            } )
            this.update()
            return true
        } )
    },
    toLCs : function () {
        // Ensure this expression wants to be included in the output
        const code = this.getMetadata( 'code' )
        const notation = this.getMetadata( 'notation' )
        if ( !code || !notation ) return [ ]
        // If this expression is just plain code, parse it and return the result
        const phrase = phrasesInForceAt( this ).find(
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
                template = template.replaceAll( param, value )
            }
        } )
        const paramNotation = phrase.getMetadata( 'notation' )
        if ( ![ 'putdown', 'smackdown' ].includes( paramNotation ) )
            throw new Error( `Invalid notation: ${paramNotation}` )
        return paramNotation == 'putdown' ?
            LogicConcept.fromPutdown( template ) :
            LogicConcept.fromSmackdown( template )
    },
    // this update function can optionally accept a "phrase" parameter, which
    // will prevent us from searching for a math phrase in force at this atom;
    // this is useful for constructing HTML of phrases that aren't actually in
    // the document, so technically nothing is "in force" at their location.
    update : function ( phrase ) {
        const notation = this.getMetadata( 'notation' )
        if ( !phrase )
            phrase = phrasesInForceAt( location || this ).find(
                phrase => phrase.getMetadata( 'name' ) == notation )
        if ( !phrase ) {
            this.fillChild( 'body',
                `${this.getMetadata( 'code' )}` )
            return
        }
        let html = phrase.getHTMLMetadata( 'htmlTemplate' ).innerHTML
        this.getMetadataKeys().forEach( key => {
            if ( key.startsWith( 'param-' ) ) {
                const param = key.substring( 6 )
                const value = this.getMetadata( key )
                html = html.replaceAll( param, escapeHTML( value ) )
            }
        } )
        this.fillChild( 'body', html )
    }
} )

export default { install }
