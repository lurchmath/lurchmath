
import { Declaration as LCDeclaration, Expression as LCExpression, LurchSymbol }
    from './lde-cdn.js'
import { appSettings } from './settings-install.js'
import { getConverter } from './math-live.js'

let converter = null
getConverter().then( result => converter = result )

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
     * @see {@link DeclarationType#lurchNotationForm lurchNotationForm()}
     * @see {@link DeclarationType#latexForm latexForm()}
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
     *  2. The placeholder `"[statement]"` will be replaced with the provided
     *     HTML, which defaults to the empty string, thus removing the body.
     * 
     * @param {string} symbol - the symbol being declared
     * @param {string} [bodyHTML] - the HTML representation of the body of the
     *   declaration, if it has a body (optional)
     * @returns {string} the template in HTML, with the symbol placeholder
     *   filled in and the body placeholder removed
     * @see {@link DeclarationType#displayForm displayForm()}
     * @see {@link DeclarationType#lurchNotationForm lurchNotationForm()}
     * @see {@link DeclarationType#latexForm latexForm()}
     */
    documentForm ( symbol, bodyHTML = '' ) {
        if ( symbol.length > 1 )
            symbol = `\\mathrm{${symbol}}`
        symbol = converter( symbol, 'latex', 'html' )
        return this.template.replace( '[statement]', bodyHTML ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }

    /**
     * This function is analogous to {@link DeclarationType#documentForm
     * documentForm()}, but produces LaTeX notation instead.
     * 
     * @param {string} symbol - the symbol being declared
     * @param {string} [bodyLatex] - the LaTeX representation of the body of the
     *   declaration, if it has a body (optional)
     * @returns {string} the template in LaTeX, with the symbol placeholder
     *   filled in and the body placeholder removed
     * @see {@link DeclarationType#displayForm displayForm()}
     * @see {@link DeclarationType#lurchNotationForm lurchNotationForm()}
     * @see {@link DeclarationType#documentForm documentForm()}
     */
    latexForm ( symbol, bodyLatex = '' ) {
        if ( symbol.length > 1 )
            symbol = `\\mathrm{${symbol}}`
        return this.template.replace( '[statement]', bodyLatex ).trim()
                            .replace( '[variable]', symbol )
                            .replace( '[constant]', symbol )
    }

    /**
     * Just as {@link DeclarationType#displayForm displayForm()} converts the
     * template into readable text, this function does the same but produces
     * Lurch notation instead, which could be parsed into a meaningful
     * LogicConcept (which would be a Declaration instance).
     * 
     * Although Lurch notation supports declaring multiple symbols in one
     * declaration, this function only supports one symbol; it could be extended
     * later to support multiple symbols.
     * 
     * @param {string} symbol - the symbol being declared
     * @param {string?} body - the body of the declaration, if this
     *   declaration type requires one, or omit it if not; this must be in Lurch
     *   notation already because it will be used as-is
     * @returns {string} the declaration in Lurch notation, using the given
     *   symbol and optional body
     * @see {@link DeclarationType#displayForm displayForm()}
     * @see {@link DeclarationType#documentForm documentForm()}
     * @see {@link DeclarationType#latexForm latexForm()}
     */
    lurchNotationForm ( symbol, body ) {
        if ( !/^\w+$/.test( symbol ) ) symbol = JSON.stringify( symbol )
        switch ( `${this.type} ${this.body}` ) {
            case 'variable none':
                return `Let ${symbol}`
            case 'variable before':
            case 'variable after':
                return `Let ${symbol} be such that ${body}`
            case 'constant none':
                return `Declare ${symbol}`
            case 'constant before':
            case 'constant after':
                return `${body} for some ${symbol}`
        }
    }

    /**
     * Given a symbol to declare and an optional body of the declaration, create
     * a LogicConcept instance representing a declaration of this type with
     * those data.  If you provide a body when one is not required by the type,
     * or you fail to provide a body when one is required, an error is thrown.
     * If the provided body is not a LogicConcept of type Expression, an error
     * is thrown.
     * 
     * @param {string} symbol - the symbol being declared
     * @param {LogicConcept?} bodyLC - the body of the declaration, if this
     *   declaration type requires one, or omit it if not; if it is provided, it
     *   is used as-is, not copied, so pass a copy if you need your original
     * @return {Declaration} the declaration as a LogicConcept instance, of type
     *   Declaration, as documented in the LDE repository
     */
    toLC ( symbol, body ) {
        const result = new LCDeclaration( new LurchSymbol( symbol ) )
        if ( body ) {
            if ( this.body == 'none' )
                throw new Error( 'Declaration type does not support a body' )
            if ( !( body instanceof LCExpression ) )
                throw new Error( 'Declaration body must be an Expression' )
            result.lastChild().replaceWith( body )
            result.makeIntoA( this.type == 'variable' ? 'Let' : 'ForSome' )
        } else {
            if ( this.body != 'none' )
                throw new Error( 'Declaration type requires a body' )
        }
        if ( !result.isA( 'ForSome' ) ) result.makeIntoA( 'given' )
        return result
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
     * @param {boolean} [addDefaults=false] - whether to add in default types
     *   for any type-body pair not included in the settings
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
