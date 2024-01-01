
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting an inline atom into the document, one that allows the user to
 * declare a new symbol using any of the five standard methods supported by the
 * Lurch Deductive Engine.
 * 
 * @module DeclarationAtoms
 */

import { Atom } from './atoms.js'
import { Dialog, TextInputItem, SelectBoxItem } from './dialog.js'
import { Declaration, LurchSymbol }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'
import { getConverter } from './math-live.js'
import { appSettings } from './settings-install.js'

let converter = null

export class DeclarationType {
    constructor ( type, body, template ) {
        this.type = type
        if ( type != 'variable' && type != 'constant' )
            throw new Error( `Invalid declaration type: ${type}` )
        this.body = body
        if ( body != 'before' && body != 'after' && body != 'none' )
            throw new Error( `Invalid body specifier: ${body}` )
        if ( template !== undefined ) {
            this.template = template
        } else {
            this.template = DeclarationType.defaultTemplate( type, body )
            if ( !this.template )
                throw new Error( `No default declaration template for ${key}` )
        }
    }
    displayForm ( symbol ) {
        return this.template.replace( '[statement]', '...' ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }
    documentForm ( symbol ) {
        if ( this.type == 'constant' && this.body == 'none' )
            symbol = `<code class="putdown-notation">${symbol}</code>`
        else
            symbol = converter( symbol, 'latex', 'html' )
        return this.template.replace( '[statement]', '' ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }
    match ( text ) {
        // const original = text
        const simple = str => str.trim().replace( /\s+/g, ' ' )
        text = simple( text )
        const parts = this.template.replace( '[statement]', '' )
            .split( `[${this.type}]` ).map( simple )
        // console.log( '\n\n--------------------\nMATCHES?', original, text, parts )
        if ( !text.toLowerCase().startsWith( parts[0].toLowerCase() ) ) {
            // console.log( 'Not initial segment:',
            //     parts[0].toLowerCase(), '---', text.toLowerCase() )
            return
        }
        text = text.substring( parts[0].length ).trim()
        const match = /^(\w+)\b/.exec( text )
        if ( !match ) {
            // console.log( 'Not an identifier:', JSON.stringify(text) )
            return
        } else {
            // console.log( match )
        }
        const symbol = match[1]
        text = text.substring( symbol.length ).trim()
        if ( parts[1] != ''
          && !parts[1].toLowerCase().startsWith( text.toLowerCase() ) ) {
            // console.log( 'Not initial segment:',
            //     text.toLowerCase(), '---', parts[1].toLowerCase() )
            return
        }
        // console.log( 'MATCH!', symbol )
        return symbol
    }
    static defaultTemplate ( type, body ) {
        return {
            'variable none' : 'Let [variable] be arbitrary',
            'variable before' : '[statement], for an arbitrary [variable]',
            'variable after' : 'Let [variable] be arbitrary and assume [statement]',
            'constant none' : 'Reserve [constant] as a new symbol',
            'constant before' : '[statement], for some [constant]',
            'constant after' : 'For some [constant], [statement]'
        }[`${type} ${body}`]
    }
    static templateToType ( template ) {
        return template.includes( '[variable]' ) ? 'variable' : 'constant'
    }
    static templateToBody ( template ) {
        return template.startsWith( '[statement]' ) ? 'before' :
               template.endsWith( '[statement]' ) ? 'after' : 'none'
    }
    static fromTemplate ( template ) {
        return new DeclarationType(
            DeclarationType.templateToType( template ),
            DeclarationType.templateToBody( template ),
            template )
    }
    static allInSettings ( addDefaults = false ) {
        const result = appSettings.get( 'declaration type templates' ).split( '\n' )
                                  .map( line => DeclarationType.fromTemplate( line ) )
        if ( addDefaults ) {
            ;[ 'variable', 'constant' ].forEach( type => {
                ;[ 'none', 'before', 'after' ].forEach( body => {
                    if ( !DeclarationType.existsPhraseFor( type, body, result ) )
                        result.push( new DeclarationType( type, body ) )
                } )
            } )
        }
        return result
    }
    static existsPhraseFor ( type, body, list ) {
        if ( !list ) list = DeclarationType.allInSettings( false )
        return list.some( declType =>
            declType.type == type && declType.body == body )
    }
}

/**
 * Install into a TinyMCE editor instance a new menu item:
 * "Declaration," intended for the Insert menu.  It creates an inline atom that
 * can be inserted into the user's document, then initiates editing on it, so
 * that the user can customize it and then confirm or cancel the insertion of it.
 * The inline atom represents the declaration of a new symbol.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    getConverter().then( result => converter = result )
    editor.ui.registry.addMenuItem( 'declaration', {
        text : 'Declaration',
        tooltip : 'Insert declaration',
        shortcut : 'Meta+D',
        onAction : () => {
            const atom = Atom.newInline( editor, '', {
                type : 'declaration',
                symbol : 'x',
                displayText : displayChoices( 'x' )[0]
            } )
            atom.update()
            atom.editThenInsert()
        }
    } )
}

/**
 * Create the HTML for a declaration atom with the given type and symbol.
 * 
 * @param {DeclarationType} declType - the type of the declaration
 * @param {string} symbol - the symbol to be declared
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which the
 *   declaration may eventually be inserted (used primarily for constructing
 *   HTML elements using its document object)
 * @function
 * 
 * @see {@link DeclarationType} for details about the first parameter
 */
export const declarationHTML = ( declType, symbol, editor ) => {
    const atom = Atom.newInline( editor, '', {
        type : 'declaration',
        symbol : symbol,
        'declaration_template' : declType.template
    } )
    atom.update()
    return atom.getHTML()
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'declaration', {
    edit : function () {
        // set up dialog contents
        const symbol = this.getMetadata( 'symbol' )
        const declType = DeclarationType.fromTemplate(
            this.getMetadata( 'declaration_template' ) )
        const dialog = new Dialog( 'Edit declaration', this.editor )
        const declTypes = DeclarationType.allInSettings( true )
        dialog.addItem( new SelectBoxItem( 'declaration_display',
            'Declaration type',
            declTypes.map( dt => dt.displayForm( symbol ) ) ) )
        dialog.addItem( new TextInputItem( 'symbol', 'Symbol to declare', symbol ) )
        // initialize dialog with data from the atom
        dialog.setInitialData( {
            symbol : symbol,
            'declaration_display' : declType.displayForm( symbol ),
        } )
        dialog.setDefaultFocus( 'symbol' )
        // if they edit the symbol, update the dropdown
        const getSelectBox = () =>
            document.querySelector( '.tox-selectfield > select' )
        let lastSelectedIndex = declTypes.map( dt => dt.template )
            .indexOf( declType.template )
        console.log( declType.template, declTypes.map( dt => dt.template ), lastSelectedIndex )
        dialog.onChange = ( _, component ) => {
            const selectBox = getSelectBox()
            lastSelectedIndex = selectBox.selectedIndex
            if ( component.name == 'symbol' ) {
                const symbol = dialog.get( 'symbol' )
                selectBox.innerHTML = declTypes.map( dt =>
                    `<option>${dt.displayForm( symbol )}</option>` ).join( '' )
                selectBox.selectedIndex = lastSelectedIndex
            }
        }
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // save the data
            this.setMetadata( 'symbol', dialog.get( 'symbol' ) )
            this.setMetadata( 'declaration_template',
                declTypes[lastSelectedIndex].template )
            this.update()
            return true
        } )
    },
    toLCs : function () {
        return [
            new Declaration(
                new LurchSymbol( this.getMetadata( 'symbol' ) )
            ).attr(
                'declaration_template',
                this.getMetadata( 'declaration_template' )
            )
        ]
    },
    toNotation : function ( notation ) {
        if ( !converter ) return
        const LCs = this.toLCs()
        let putdown = ''
        LCs.forEach( LC => putdown += LC.toPutdown() + '\n' )
        return converter( putdown, 'putdown', notation )
    },
    update : function () {
        const symbol = this.getMetadata( 'symbol' )
        const declType = DeclarationType.fromTemplate(
            this.getMetadata( 'declaration_template' ) )
        this.fillChild( 'body', declType.documentForm( symbol ) )
    }
} )

export default { install }
