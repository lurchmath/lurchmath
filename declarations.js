
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
import { LogicConcept }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'
import { getConverter } from './math-live.js'

let converter = null

// Internal use only
// List of all declaration types
const declarationTypes = [
    {
        name : 'Let',
        template : 'Let _ be arbitrary'
    },
    {
        name : 'LetWithBody',
        template : 'Let _ be such that...'
    },
    {
        name : 'ForSomePrefix',
        template : 'For some _, ...'
    },
    {
        name : 'ForSomeSuffix',
        template : '..., for some _'
    },
    {
        name : 'Declare',
        template : 'Reserve a new symbol _'
    }
]
const nameToType = name => declarationTypes.find( item => item.name == name )
const displayTextToType = displayText => declarationTypes.find( item => {
    const [ prefix, suffix ] = item.template.split( '_', 2 )
    return displayText.startsWith( prefix ) && displayText.endsWith( suffix )
} )
const fillTemplate = ( type, symbol, keepEllipsis=true ) => {
    const result = type.template.replaceAll( '_', symbol )
    return keepEllipsis ? result : result.replaceAll( '...', '' )
}
const displayChoices = symbol =>
    declarationTypes.map( type => fillTemplate( type, symbol ) )

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
 * @param {string} typeName - the type of the declaration, which should be one
 *   of the names in the `declarationTypes` array ('Let', 'LetWithBody',
 *   'ForSomePrefix', 'ForSomeSuffix', or 'Declare')
 * @param {string} symbol - the symbol to be declared
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which the
 *   declaration may eventually be inserted (used primarily for constructing
 *   HTML elements using its document object)
 * @function
 */
export const declarationHTML = ( typeName, symbol, editor ) => {
    const type = nameToType( typeName )
    const atom = Atom.newInline( editor, '', {
        type : 'declaration',
        symbol : symbol,
        displayText : fillTemplate( type, symbol )
    } )
    atom.update()
    return atom.getHTML()
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'declaration', {
    edit : function () {
        // set up dialog contents
        const symbol = this.getMetadata( 'symbol' )
        const displayText = this.getMetadata( 'displayText' )
        const type = displayTextToType( displayText )
        const dialog = new Dialog( 'Edit declaration', this.editor )
        dialog.addItem( new SelectBoxItem( 'displayText', 'Declaration type',
            displayChoices( symbol ) ) )
        dialog.addItem( new TextInputItem( 'symbol', 'Symbol to declare', symbol ) )
        // initialize dialog with data from the atom
        dialog.setInitialData( {
            symbol : symbol,
            displayText : fillTemplate( type, symbol )
        } )
        dialog.setDefaultFocus( 'symbol' )
        // if they edit the symbol, update the dropdown
        dialog.onChange = ( _, component ) => {
            if ( component.name == 'symbol' ) {
                const symbol = dialog.get( 'symbol' )
                const selectBox = document.querySelector(
                    '.tox-selectfield > select' )
                const lastIndex = selectBox.selectedIndex
                selectBox.innerHTML = displayChoices( symbol ).map(
                    text => `<option>${text}</option>` ).join( '' )
                selectBox.selectedIndex = lastIndex
            }
        }
        // Show it and if they accept any changes, apply them to the atom.
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            // save the data
            this.setMetadata( 'symbol', dialog.get( 'symbol' ) )
            this.setMetadata( 'displayText', dialog.get( 'displayText' ) )
            this.update()
            return true
        } )
    },
    toLCs : function () {
        const symbolString = JSON.stringify( this.getMetadata( 'symbol' ) )
        const displayText = this.getMetadata( 'displayText' )
        const typeName = displayTextToType( displayText ).name
        const decl = LogicConcept.fromPutdown( `[${symbolString}]` )[0]
            .asA( typeName )
        if ( [ 'Let', 'LetWithBody', 'Declare' ].includes( typeName ) )
            decl.makeIntoA( 'given' )
        return [ decl ]
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
        const displayText = this.getMetadata( 'displayText' )
        const type = displayTextToType( displayText )
        const typesetSymbol = converter( symbol, 'latex', 'html' )
        const repr = fillTemplate( type, typesetSymbol, false )
        this.fillChild( 'body', repr )
    }
} )

export default { install }
