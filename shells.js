
/**
 * In a Lurch document, certain sections will be marked as "shells."  These will
 * always be DIVs and will typically contain other document content.  While
 * {@link module:Atoms atoms (as defined in the Atoms module)} are indivisible
 * sections of special, meaningful document content, shells are also special,
 * meaningful document content, but are not indivisible.  They are intended to
 * contain other document content.
 * 
 *  1. The user can edit what sits inside a shell, but the application
 *     determines how the shell is drawn as a visual wrapper around that
 *     content.
 *  2. The user can edit the shells's properties by clicking on it (the visual
 *     boundary around the content, not the content itself) and interacting with
 *     whatever dialog the application pops up in response.
 *  3. There can be many different types of shells.  For example, a theorem
 *     statement may be one type, and a proof or subproof may be another.  The
 *     type is stored as an attribute of the shell's HTML element.
 *  4. Like atoms, each shell will typically have some meaning that will be
 *     important when the document is processed in a mathematical way.
 * 
 * Shells are represented in the document by DIVs with a certain class attached
 * to mark them as shells.
 * 
 * This module contains tools for working with shells, including the
 * {@link module:Shells.className class name} we use to distinguish them, the
 * {@link module:Shells.install function} we use to install their
 * mouse event handlers, and most importantly, the
 * {@link module:Shells.Atom class} we use to create an API for working with
 * individual shells.
 *
 * @module Shells
 * @see {@link module:Atoms the Atoms module}
 */

import { getHeader } from './header-editor.js'
import { onlyBefore, isOnScreen } from './utilities.js'
import { className as atomClassName } from './atoms.js'
import { addAutocompleteFunction } from './auto-completer.js'
import { Dialog, SelectBoxItem } from './dialog.js'
import { Environment }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

/**
 * Class name used to distinguish HTML elements representing shells.  (For an
 * explanation of what a shell is, see the documentation for
 * {@link module:Shells the module itself}.)
 */
export const className = 'lurch-shell'

// Internal use only
// The shell types the user is allowed to choose when inserting one
const shellTypes = [
    {
        name : 'Definition',
        representation : 'Definition',
        attributeName : 'Rule',
        given : true,
        children : 'givens'
    },
    {
        name : 'Rule',
        representation : 'Rule',
        attributeName : 'Rule',
        given : true,
        children : 'givens'
    },
    {
        name : 'Axiom',
        representation : 'Axiom',
        attributeName : 'Rule',
        given : true,
        children : 'givens'
    },
    {
        name : 'Theorem',
        representation : 'Theorem',
        attributeName : 'theorem',
        given : false,
        children : 'givens'
    },
    {
        name : 'Lemma',
        representation : 'Lemma',
        attributeName : 'theorem',
        given : false,
        children : 'givens'
    },
    {
        name : 'Corollary',
        representation : 'Corollary',
        attributeName : 'theorem',
        given : false,
        children : 'givens'
    },
    {
        name : 'Proof',
        representation : 'Proof',
        attributeName : null,
        given : false,
        children : 'claims'
    },
    {
        name : 'Subproof',
        representation : null,
        attributeName : null,
        given : false,
        children : 'claims'
    },
    {
        name : 'Recall',
        representation : 'Recall',
        attributeName : 'hint',
        given : false,
        children : 'givens'
    }
]

// Should document this later.
export const getShellType = name => shellTypes.find( type => type.name == name )

export class Shell {

    // Internal use only: Stores a mapping from atom types to event handlers for
    // shells of that type.  Public use of this data should be done through the
    // addType() function below; clients do not need to read this data.
    static handlers = new Map()

    /**
     * This class will watch for various UI events on shells in the editor, and
     * will call appropriate event handlers based on the type of shell that was
     * involved.  To register one or more event handlers, call this function.
     * The set of event handlers and their signatures are documented below, and
     * may grow with time.
     * 
     *  * "Edit" event signature: one parameter, the Shell instance for which
     *    editing was initiated (by a click or by highlighting it and pressing
     *    the Enter key)
     * 
     * @param {string} type - the type of shell for which to register an event
     *   handler
     * @param {function} handlers - an object mapping event types (strings like
     *   "edit") to event handlers (functions)
     */
    static addType ( type, handlers ) { Shell.handlers.set( type, handlers ) }

    /**
     * Construct a new instance of this class corresponding to the shell
     * represented by the given `HTMLDivElement`.  Recall that the purpose of
     * this class, as documented above, is to provide an API for consistent and
     * convenient use of shells, an API that is not part of the `HTMLDivElement`
     * API.  Thus to use that API, you use this constructor and then call
     * functions on the resulting object.  The intent is for such instances to
     * be ephemeral, in the sense that you can create one, use it, and let it be
     * garbage collected immediately thereafter, with little performance cost.
     * 
     * @param {HTMLDivElement} element - the element in the editor representing
     *   the shell
     * @param {tinymce.Editor} editor - the editor in which the element sits
     */
    constructor ( element, editor ) {
        if ( !Shell.isShellElement( element ) )
            throw new Error( 'This is not a shell element: ' + element )
        this.element = element
        this.editor = editor
        const type = this.getType()
        if ( Shell.handlers.has( type ) ) {
            const handlers = Shell.handlers.get( type )
            Object.keys( handlers ).forEach( eventName =>
                this[eventName] = handlers[eventName] )
        }
    }

    /**
     * Get the HTML representation of this shell, as it currently sits in the
     * document.
     * 
     * @returns {string} the HTML representation of this shell
     * @see {@link module:Atoms.Atom#getHTML getHTML()}
     */
    getHTML () { return this.element.outerHTML }

    /**
     * Each shell may have a type, which is a string that allows for
     * partitioning the set of shells into categories that behave differently.
     * To see how to assign different behaviors to each type of shell, see the
     * {@link module:Shells.Shell.addType addType() static function}.  This
     * function gets the type of this shell.
     * 
     * @returns {string?} the type of this shell
     * @see {@link module:Shells.Shell.addType addType()}
     * @see {@link module:Shells.Shell#setType setType()}
     */
    getType () { return this.element.dataset.type }

    /**
     * Each shell may have a type, which is a string that allows for
     * partitioning the set of shells into categories that behave differently.
     * To see how to assign different behaviors to each type of shell, see the
     * {@link module:Shells.Shell.addType addType() static function}.  This
     * function changes the type of this shell to whatever you pass as the
     * parameter.
     * 
     * @param {string?} type - the type to set (or undefined to clear out the
     *   old type value, resetting it to undefined)
     * @see {@link module:Shells.Shell.addType addType()}
     * @see {@link module:Shells.Shell#getType getType()}
     */
    setType ( type ) { this.element.dataset.type = type }

    /**
     * Set (or clear) the hover text on this shell.  Hover text is what's shown
     * in a small popup when the user hovers over the shell in the editor.
     * 
     * @param {string?} text - the text to set as the hover text for this
     *   shell's HTMLElement, or `null` to remove the hover text
     */
    setHoverText ( text ) {
        if ( text )
            this.element.setAttribute( 'title', text )
        else
            this.element.removeAttribute( 'title' )
    }

    // Internal use only:
    // get/set what type of environment this is (Theorem, Proof, etc.)
    getEnvironmentType () {
        return this.element.dataset['environment_type_name']
            || shellTypes[0].name
    }
    setEnvironmentType ( name ) {
        const shellType = getShellType( name )
        if ( shellType && shellType.name )
            this.element.dataset['environment_type_name'] = shellType.name
        else
            delete this.element.dataset['environment_type_name']
        if ( shellType && shellType.representation )
            this.element.dataset['environment_type_representation'] =
                shellType.representation
        else
            delete this.element.dataset['environment_type_representation']
    }

    /**
     * Convert this shell into an LC representing it.  It will be a single
     * Environment, optionally with its given flag set, based on the result of
     * {@link module:Shells.Shell#isGiven isGiven()}.
     * 
     * @returns {Environment} an Environment instance representing this shell
     * @see {@link module:Shells.Shell#isGiven isGiven()}
     */
    toLC () {
        const result = new Environment()
        const shellType = getShellType( this.getEnvironmentType() )
        if ( shellType && shellType.attributeName )
            result.makeIntoA( shellType.attributeName )
        return result
    }

    // Internal use only:
    // Default handler for environments.  Allows toggling given/claim status.
    edit () {
        const dialog = new Dialog( 'Edit environment', this.editor )
        dialog.addItem( new SelectBoxItem(
            'shellType', 'Which type of environment to insert?',
            shellTypes.map( type => type.name )
        ) )
        dialog.setDefaultFocus( 'shellType' )
        dialog.setInitialData( { shellType : this.getEnvironmentType() } )
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            this.setEnvironmentType( dialog.get( 'shellType' ) )
            return true
        } )
    }

    /**
     * The standard way to insert a new shell into the editor is to create it
     * off screen, open up an editing dialog for that shell, and then if the
     * user saves their edits, insert the new shell into the document, in the
     * final state that represents the user's edits.  If, however, the user
     * cancels their edit of the shell, don't insert anything into the document.
     * 
     * This function does exactly that, when called on an offscreen shell,
     * passing the editor into which to insert the shell as the first parameter.
     * 
     * @see {@link module:Atoms.Atom.editThenInsert editThenInsert()}
     */
    editThenInsert () {
        this.edit().then( userSaved => {
            if ( userSaved ) this.editor.insertContent( this.getHTML() )
        } )
    }

    /**
     * Set the suffix of the shell to reflect its validation result.
     * 
     * See the documentation for {@link module:Atoms.Atom#setValidationResult
     * the setValidationResult() function in the Atom class} for the explanation
     * of the function and parameters of this method.  It is identical to that
     * one, except that it operates on shells instead of atoms.
     *
     * @see {@link module:Atoms.Atom#setValidationResult setValidationResult()}
     */
    setValidationResult ( result, reason ) {
        if ( !result ) {
            delete this.element.dataset['validation_result']
            this.setHoverText( null )
        } else {
            this.element.dataset['validation_result'] = result
            this.setHoverText( reason )
        }
    }

    /**
     * One can construct an instance of the Shell class to interface with an
     * element in the editor only if that element actually represents a shell,
     * as defined in {@link module:Shells the documentation for the Shells
     * module}.  This function checks to see if the element in question does.
     * To create elements that do represent shells, see
     * {@link module:Shells.Shell.createElement createElement()}.
     * 
     * @param {HTMLElement} element - the element to check
     * @returns {boolean} whether the element represents a shell
     * @see {@link module:Shells.Shell.createElement createElement()}
     * @see {@link module:Shells.Shell.findAbove findAbove()}
     */
    static isShellElement ( element ) {
        return element.tagName == 'DIV'
            && element.classList.contains( className )
    }

    /**
     * Create an HTMLDivElement that can be placed into the given `editor` and
     * that represents a shell, whose type is given by the parameter.  The
     * element will be given an HTML/CSS class that marks it as representing a
     * shell.
     * 
     * @param {tinymce.Editor} editor - the TinyMCE editor in which to create
     *   the element
     * @param {string} type - the type of the shell to create
     * @param {string} content - the content of the new shell (defaults to a
     *   single non-breaking space)
     * @returns {HTMLDivElement} the element constructed
     */
    static createElement ( editor, type, content='<br data-mce-bogus="1">' ) {
        const result = editor.dom.doc.createElement( 'div' )
        result.classList.add( className )
        result.dataset.type = type
        result.innerHTML = `<p>${content}</p>`
        return result
    }

    /**
     * Find all elements in the given TinyMCE editor that represent shells, and
     * return each one, transformed into an instance of the Shell class.  They
     * are returned in the order they appear in the document.
     * 
     * @param {tinymce.Editor} editor - the editor in which to search
     * @returns {Atom[]} the array of shell elements in the editor's document
     */
    static allIn ( editor ) {
        return Array.from( editor.dom.doc.querySelectorAll( `.${className}` ) )
            .filter( isOnScreen ).map( element => new Shell( element, editor ) )
    }

    /**
     * This function can take any DOM node and walk up its ancestor chain and
     * find whether any element in that chain represents a shell.  If so, it
     * returns the corresponding Shell instance.  If not, it returns null.
     * 
     * @param {Node} node - the DOM node from which to begin searching
     * @param {tinymce.Editor} editor - the editor in which the node sits
     * @returns {Shell?} the nearest Shell enclosing the given `node`
     * @see {@link module:Shells.Shell.isShellElement isShellElement()}
     */
    static findAbove ( node, editor ) {
        for ( let walk = node ; walk ; walk = walk.parentNode )
            if ( Shell.isShellElement( walk ) )
                return new Shell( walk, editor )
    }

    /**
     * Accessibility of HTML nodes sitting inside a hierarchy of Shells is
     * analogous to accessibility of `MathConcept` or `LogicConcept` instances
     * inside their own hierarchy.  The shells create the hierarchy/tree and the
     * HTML nodes within them act as leaves of the tree.
     * 
     * Of course, one HTML node is not accessible to another if it comes later
     * in the document, so this function assumes that you are asking about
     * accessibility of an earlier node to a later node.  It does not check to
     * be sure that this is true; the client must ensure that.
     * 
     * It returns true if the `earlier` node is accessible to the `later` node.
     * 
     * @param {Node} earlier - the earlier of the two DOM nodes to compare
     * @param {Node} later - the later of the two DOM nodes to compare
     * @param {tinymce.Editor} - the editor in which these nodes sit
     * @returns {boolean} whether the `earlier` node is accessible to the
     *   `later` node
     */
    static isAccessibleTo ( earlier, later, editor ) {
        let walk1 = earlier
        let walk2 = later
        while ( walk1 ) {
            if ( !walk2 ) return false
            walk1 = Shell.findAbove( walk1.parentNode, editor )
            walk2 = Shell.findAbove( walk2.parentNode, editor )
            if ( walk1 && ( walk1 !== walk2 ) ) return false
        }
        return true
    }

    /**
     * For the meaning of accessibility, see
     * {@link module:Shells.Shell.isAccessibleTo isAccessibleTo()}.
     * This function returns the array of all HTML nodes that are accessible to
     * the given `target` in the given `editor`, as long as they have the given
     * `className` and satisfy the given `predicate`.  HTML nodes that appear in
     * dependencies and in the document header are also included.  All nodes are
     * returned in the order that they appear in the document (counting the
     * header as earliest).
     * 
     * The predicate can be omitted and defaults to an accessibility check
     * relative to the given `target` node.  The class name can be omitted and
     * defaults to the class name used to mark nodes as being part of the
     * {@link module:Atoms.Atom Atoms module}.
     * 
     * @param {tinymce.Editor} editor - the editor in which to search
     * @param {Node} target - the node to use for filtering the result list
     * @param {Function?} predicate - a function that takes a node and returns
     *   true if that node should be included in the results
     * @param {string?} className - the class name of the nodes to include
     * @returns {Node[]} the ordered array of accessible nodes satisfying all of
     *   the given criteria
     */
    static accessibles (
        editor, target, predicate = null, className = atomClassName
    ) {
        if ( !predicate )
            predicate = node => Shell.isAccessibleTo( node, target, editor )
        return [
            // dependencies in header:
            ...( getHeader( editor )?.querySelectorAll( `.${className}` ) || [ ] ),
            // nodes in document preceding target:
            ...onlyBefore( editor.dom.doc.querySelectorAll( `.${className}` ), target )
        ].filter( isOnScreen ).filter( predicate )
    }

}

/**
 * This function should be called in the editor's setup routine.  It installs
 * several things into the editor:
 * 
 *  * a mouse event handler that can watch for click events to any shell, and
 *    route control flow to the event handler for that shell's type, falling
 *    back on the {@link module:Shells.Shell#edit edit()} method for an untyped
 *    shell
 *  * the css classes that can be used to format shells with css, and how to
 *    visually distinguish given shells from claim shells
 *  * a menu item for inserting "environments" (untyped shells)
 *  * an event handler for deleting empty environments (which can occur if the
 *    user creates an environment, leaves it empty, and then positions their
 *    cursor after it and hits backspace---a corner case, but still one we must
 *    handle correctly)
 *  * two menu items for inserting blank paragraphs before and after the current
 *    block, so that the user does not get stuck unable to move their cursor
 *    after the last shell in the document, or before the first, or between two
 *    adjacent ones
 *  * an autocompleter shortcut that replaces `\{` with an "environment" (an
 *    untyped shell)
 * 
 * @param {tinymce.Editor} editor - the editor in which to install the features
 *   described above
 * @function
 */
export const install = editor => {
    editor.on( 'init', () => {
        // The mouse handler described above
        editor.dom.doc.body.addEventListener( 'click', event => {
            if ( Shell.isShellElement( event.target ) ) {
                const receiver = new Shell( event.target, editor )
                const type = receiver.getType()
                if ( Shell.handlers.has( type ) ) {
                    const handlers = Shell.handlers.get( type )
                    if ( handlers.hasOwnProperty( 'edit' ) )
                        handlers['edit']( receiver )
                    else
                        receiver.edit() // default handler
                } else {
                    receiver.edit() // default handler
                }
            }
        } )
    } )
    // The first menu item described above
    // (We do not call it "insert environment" because it will go on the insert
    // menu, so it just needs the word "Environment")
    editor.ui.registry.addMenuItem( 'environment', {
        icon : 'unselected',
        text : 'Environment',
        tooltip : 'Insert block representing an environment',
        shortcut : 'Meta+Shift+E',
        onAction : () => {
            const shell = new Shell( Shell.createElement(
                editor, 'environment', editor.selection.getContent()
            ), editor )
            shell.editThenInsert()
        }
    } )
    // The event handler for the corner case described above
    editor.on( 'NodeChange keyup', () => {
        Array.from(
            editor.dom.doc.querySelectorAll( `.${className}` )
        ).forEach( shellElement => {
            if ( !shellElement.querySelector( 'p' ) ) shellElement.remove()
        } )
    } )
    // The two actions for inserting blank paragraphs, described above
    // (Same comments apply as given above, re: Insert menu and naming)
    editor.ui.registry.addMenuItem( 'paragraphabove', {
        text : 'Empty paragraph above',
        tooltip : 'Insert an empty paragraph above the current block',
        shortcut : 'Meta+Shift+Enter',
        onAction : () => {
            for ( let walk = editor.selection.getStart()
                ; walk
                ; walk = walk.parentNode )
            {
                if ( walk.parentNode && walk.tagName == 'DIV' ) {
                    const newPara = editor.dom.doc.createElement( 'p' )
                    newPara.innerHTML = '<br data-mce-bogus="1">'
                    walk.parentNode.insertBefore( newPara, walk )
                    editor.selection.setCursorLocation( newPara, 0 )
                    editor.focus()
                    return
                }
            }
        }
    } )
    editor.ui.registry.addMenuItem( 'paragraphbelow', {
        text : 'Empty paragraph below',
        tooltip : 'Insert an empty paragraph below the current block',
        shortcut : 'Meta+Enter',
        onAction : () => {
            for ( let walk = editor.selection.getStart()
                ; walk
                ; walk = walk.parentNode )
            {
                if ( walk.parentNode && walk.tagName == 'DIV' ) {
                    const newPara = editor.dom.doc.createElement( 'p' )
                    newPara.innerHTML = '<br data-mce-bogus="1">'
                    walk.parentNode.insertBefore( newPara, walk.nextSibling )
                    editor.selection.setCursorLocation( newPara, 0 )
                    editor.focus()
                    return
                }
            }
        }
    } )
    // The user can insert an environment using an autocompleter:
    addAutocompleteFunction( editor => {
        shellTypes.forEach( shellType => {
            if ( !shellType.hasOwnProperty( 'html' ) ) {
                const element = Shell.createElement( editor, 'environment', '' )
                const shell = new Shell( element, editor )
                shell.setEnvironmentType( shellType.name )
                shellType.html = element.outerHTML
            }
        } )
        return shellTypes.map( shellType => {
            return {
                shortcut : shellType.name.toLowerCase(),
                preview : `${shellType.name} environment`,
                content : shellType.html
            }
        } )
    } )
}

export default { className, Shell, install }
