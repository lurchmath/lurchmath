
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
import { Declaration as LDEDeclaration, LurchSymbol }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'
import { getConverter } from './math-live.js'
import { appSettings } from './settings-install.js'

let converter = null

/**
 * Declarations of new symbols can be phrased in a wide variety of ways.  This
 * class helps detect and work with the essential properties that any of those
 * phrasings will exhibit.  Those essential properties are:
 * 
 *  1. Does it declare a variable or a constant?
 *      * A "variable" declaration is typically used for introducing a new,
 *        arbitrary symbol at the start of a proof or subproof, and functions
 *        like a hypothesis
 *      * A "constant" declaration names a concept that is usually known to
 *        exist before the declaration, and may be justified by an existential
 *  2. Does it have a body, and if so, where does it belong?
 *      * Not every declaration has a body (that is, a corresponding expression).
 *        For example, we can write "Let x be arbitrary" and that declares a new
 *        variable with no assumptions about it (no expression attached).
 *      * A declaration like "Let epsilon be arbitrary with epsilon>0" is like
 *        the previous case, but now with an attached assumption (its "body"
 *        following after the declaration).
 *      * A declaration like "m=2k for some k" is a declaration of k, with its
 *        body preceding the declaration, and may need to be justified by a fact
 *        like "m is even".
 *      * Thus bodies may or may not exist, and if they do exist, they are in
 *        one of two places: *before* or *after* the declaration.
 * 
 * This class embodies a type of declaration, which includes three pieces of
 * data: the *type* (variable or constant), the *body* (none, before, or after),
 * and the *template* (which is how the declaration is phrased in English, with
 * placeholders, such as "Let [variable] be arbitrary").  This data is redundant
 * in the following ways.
 * 
 *  * If you have the type and body, we can construct a simple template.
 *    Common English phrases for every type-body pair are included in this
 *    class, and can be filled in where needed.
 *  * If you have the template, the type and body can be computed from the
 *    values and position of its placeholders.
 */
export class DeclarationType {

    /**
     * Create a declaration type from a given type and body.  The template is
     * optional; if not provided, a simple, English template will be generated
     * that fits the given type and body.  If the template is provided, it should
     * contain precisely one copy of the string `"[variable]"` or the string
     * `"[constant]"` (depending on the type you're creating) and optionally
     * precisely one copy of `"[statement]"`, which must appear at either the
     * start or end of the template, if it appears at all.
     * 
     * These properties of the third parameter are not validated; the caller
     * must ensure that they hold.  Furthermore, the constructor does not verify
     * that the type and body implied by the template match those provided in
     * the first two parameters; the caller must ensure this as well.
     * 
     * @param {string} type - one of "variable" or "constant" as documented above
     * @param {string} body - one of "none", "before", or "after" as documented
     *   above
     * @param {string?} template - the template in English, with placeholders, as
     *   documented above
     * @see {@link DeclarationType.fromTemplate fromTemplate()}
     */
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

    /**
     * A template like "Let [variable] be arbitrary" can be converted into more
     * readable text like "Let x be arbitrary" if we know the name of the symbol
     * being declared (in that case, x).  This function performs that
     * replacement, and replaces the `[statement]` placeholder with an ellipsis,
     * so that, for example, "For some [constant], [statement]" may become
     * "For some c, ...".
     * 
     * @param {string} symbol - the symbol being declared
     * @returns {string} the template with all placeholders replaced with
     *   readable text
     * @see {@link DeclarationType#documentForm documentForm()}
     */
    displayForm ( symbol ) {
        return this.template.replace( '[statement]', '...' ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }

    /**
     * Just as {@link DeclarationType#displayForm displayForm()} converts the
     * template into readable text, this function does the same but produces
     * HTML instead, for use in the editor.  There are two important differences
     * between this and {@link DeclarationType#displayForm displayForm()}.
     * 
     *  1. The symbol being declared will be represented either using LaTeX-style
     *     typesetting or fixed-width font, depending on the type of declaration.
     *  2. The placeholder `"[statement]"` will be removed entirely, because we
     *     expect that the actual statement should be sitting adjacent to the
     *     declaration in the document, and thus the placeholder should go away.
     * 
     * @param {string} symbol - the symbol being declared
     * @returns {string} the template in HTML, with the symbol placeholder
     *   filled in and the body placeholder removed
     * @see {@link DeclarationType#displayForm displayForm()}
     */
    documentForm ( symbol ) {
        if ( this.type == 'constant' && this.body == 'none' )
            symbol = `<code class="putdown-notation">${symbol}</code>`
        else
            symbol = converter( symbol, 'latex', 'html' )
        return this.template.replace( '[statement]', '' ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }

    /**
     * When the user enters a dollar sign (`$`) in the editor, the application
     * will watch for math-like content thereafter.  If it sees that the user
     * seems to be typing a declaration, it will offer to autocomplete it.  In
     * order for the application to notice that the user seems to be typing a
     * declaration, instances of this class need to evaluate the text the user
     * has typed so far and decide whether it fits (the first part of) the
     * pattern in our template.  This function does that work.
     * 
     * @param {string} text - some text the user has typed into the editor, to
     *   be evaluated for whether it triggers autocompletion using this
     *   declaration type
     * @returns {string?} either the symbol being declared if a match is found,
     *   or `undefined` if no match is found
     */
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

    /**
     * When we need to create a declaration type given just the type and body
     * information, without a template phrase, we need a simple way to generate
     * a suitable phrase.  This function knows six simple English phrases, one
     * suitable for each of the six type-body combinations.
     * 
     * @param {string} type - one of "variable" or "constant" as documented at
     *   the top of this class
     * @param {string} body - one of "none", "before", or "after" as documented
     *   at the top of this class
     * @returns {string} a simple English template for the given type and body
     */
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

    /**
     * Given a template phrase (as documented in the constructor), discern
     * whether it describes the declaration of a variable or constant.
     * 
     * @param {string} template - a template phrase as documented in the
     *   constructor
     * @returns {string} one of "variable" or "constant"
     */
    static templateToType ( template ) {
        return template.includes( '[variable]' ) ? 'variable' : 'constant'
    }

    /**
     * Given a template phrase (as documented in the constructor), discern
     * whether it describes a declaration that expects a body before it, after
     * it, or does not expect a body.
     * 
     * @param {string} template - a template phrase as documented in the
     *   constructor
     * @returns {string} one of "none", "before", or "after"
     */
    static templateToBody ( template ) {
        return template.startsWith( '[statement]' ) ? 'before' :
               template.endsWith( '[statement]' ) ? 'after' : 'none'
    }

    /**
     * The constructor for this class expects you to provide a type and body,
     * but if you already have a template phrase, you can use this function to
     * construct a DeclarationType instance from that phrase alone, because the
     * type and body can be computed from the phrase using
     * {@link DeclarationType.templateToType templateToType()} and
     * {@link DeclarationType.templateToBody templateToBody()}.
     * 
     * @param {string} template - a template phrase as documented in the
     *   constructor
     * @returns {DeclarationType} a new DeclarationType instance that uses the
     *   given template, and has a type and body appropriate to it
     */
    static fromTemplate ( template ) {
        return new DeclarationType(
            DeclarationType.templateToType( template ),
            DeclarationType.templateToBody( template ),
            template )
    }

    /**
     * The application settings allows the user to choose a set of phrases that
     * can be used as templates for declaration types.  This function fetches
     * those phrases and creates a declaration type instance for each.  Also, if
     * the parameter is set to true, it adds in default types for any type-body
     * pair not represented by a phrase in the settings.
     * 
     * @param {boolean=false} addDefaults - whether to add in default types for
     *   any type-body pair not included in the settings
     * @returns {DeclarationType[]} an array of all DeclarationType instances
     *   mentioned in the user's settings, plus any default types needed, if the
     *   caller requested them with `addDefaults`
     */
    static allInSettings ( addDefaults = false ) {
        const result = appSettings.get( 'declaration type templates' ).split( '\n' )
                                  .map( line => DeclarationType.fromTemplate( line ) )
        if ( addDefaults ) {
            ;[ 'variable', 'constant' ].forEach( type => {
                ;[ 'none', 'before', 'after' ].forEach( body => {
                    if ( !DeclarationType.existsTemplateFor( type, body, result ) )
                        result.push( new DeclarationType( type, body ) )
                } )
            } )
        }
        return result
    }

    /**
     * Given a list of declaration types, does one of them have the given type
     * and body?  This function determines that.  It defaults to searching the
     * list of declaration types in the user's current settings, but you can
     * pass whatever list you want the function to search.
     * 
     * @param {string} type - one of "variable" or "constant" as documented at
     *   the top of this class
     * @param {string} body - one of "none", "before", or "after" as documented
     *   at the top of this class
     * @param {DeclarationType[]?} list - the list of declaration types in which
     *   to search (which defaults to the list in the user's current settings)
     * @returns {boolean} whether a declaration on the list has the given type
     *   and body
     */
    static existsTemplateFor ( type, body, list ) {
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
                'declaration_template' :
                    DeclarationType.allInSettings( true )[0].displayForm( 'x' )
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
export class Declaration extends Atom {

    static subclassName = Atom.registerSubclass( 'declaration', Declaration )

    /**
     * Shows a multi-part dialog for editing declaration atoms, including
     * choosing the phrase that defines the declaration as well as the symbol
     * being declared.  The user can then confirm or cancel the edit,
     * as per the convention described in {@link module:Atoms.Atom#edit the
     * edit() function for the Atom class}.
     * 
     * @returns {Promise} same convention as specified in
     *   {@link module:Atoms.Atom#edit edit() for Atoms}
     */
    edit () {
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
    }

    /**
     * This function returns an array of LogicConcepts representing the meaning
     * of this atom, which in this case will be an array containing precisely
     * one thing, a Declaration LogicConcept representing the meaning of this
     * Declaration.
     * 
     * @returns {LogicConcept[]} an array containing one LogicConcept, the
     *   meaning of this declaration
     */
    toLCs () {
        return [
            new LDEDeclaration(
                new LurchSymbol( this.getMetadata( 'symbol' ) )
            ).attr( {
                'declaration_template' :
                    this.getMetadata( 'declaration_template' )
            } )
        ]
    }

    /**
     * Update the HTML representation of this declaration.  We do so by
     * delegating the work to the
     * {@link module:Declarations.DeclarationType.documentForm documentForm()}
     * function of the {@link DeclarationType} class.
     */
    update () {
        const symbol = this.getMetadata( 'symbol' )
        const declType = DeclarationType.fromTemplate(
            this.getMetadata( 'declaration_template' ) )
        this.fillChild( 'body', declType.documentForm( symbol ) )
    }

}

export default { install }
