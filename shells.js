
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

/**
 * Class name used to distinguish HTML elements representing shells.  (For an
 * explanation of what a shell is, see the documentation for
 * {@link module:Shells the module itself}.)
 */
export const className = 'lurch-shell'

// Internal use only
// Whether this shell represents a "given" environment
const givenClassName = 'lurch-given'

export class Shell {

    // Internal use only: Stores a mapping from atom types to event handlers for
    // shells of that type.  Public use of this data should be done through the
    // addType() function below; clients do not need to read this data.
    static handlers = new Map()

    /**
     * This class will watch for click events on shells in the editor, and will
     * call appropriate event handlers based on the type of shell that was
     * clicked.  To register a click event handler, call this function.  The
     * handler will be called with one parameter, the Shell instance that was
     * clicked.
     * 
     * @param {string} type - the type of shell for which to register an event
     *   handler
     * @param {function} handler - the event handler being registered
     */
    static addType ( type, handler ) { Shell.handlers.set( type, handler ) }

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
    }

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
     * In Lurch, elements can be classified as either *givens* or *claims,* for
     * validation purposes.  A *given* means exactly what it does in high school
     * geometry---a hypothesis from which other conclusions will probably be
     * drawn.  Shells can be marked as givens, and if they are not, they default
     * to being claims.
     * 
     * @returns {boolean} whether this shell is a given
     */
    isGiven () { return this.element.classList.contains( givenClassName ) }

    // Internal use only:
    // Default handler for environments.  Allows toggling given/claim status.
    edit () {
        const dialog = this.editor.windowManager.open( {
            title : 'Edit environment',
            body : {
                type : 'panel',
                items : [
                    {
                        type : 'checkbox',
                        name : 'isGiven',
                        label : 'This environment is an assumption/given'
                    }
                ]
            },
            initialData : {
                isGiven : this.element.classList.contains( givenClassName )
            },
            buttons : [
                { text : 'OK', type : 'submit' },
                { text : 'Cancel', type : 'cancel' }
            ],
            onSubmit : dialog => {
                if ( dialog.getData()['isGiven'] )
                    this.element.classList.add( givenClassName )
                else
                    this.element.classList.remove( givenClassName )
                dialog.close()
            }
        } )
        setTimeout( () => dialog.focus( 'isGiven' ), 0 )
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
    static createElement ( editor, type, content='&nbsp;' ) {
        const result = editor.dom.doc.createElement( 'div' )
        result.classList.add( className )
        result.dataset.type = type
        result.innerHTML = `<p>${content}</p>`
        return result
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
 *  * a small stylesheet that specifies how to format shells, and how to
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
                if ( Shell.handlers.has( type ) )
                    Shell.handlers.get( type )( receiver )
                else
                    receiver.edit() // default handler
            }
        } )
        // The small stylesheet described above
        editor.dom.doc.head.innerHTML += `
            <style>
                div.${className} {
                    position: relative;
                    border: 1px solid #bbb;
                    border-radius: 6px;
                    padding: 0 1em;
                    margin: 1ex 0;
                }
                div.${className}.${givenClassName} {
                    border: 2px dashed #bbb;
                }
            </style>
        `
    } )
    // The first menu item described above
    // (We do not call it "insert environment" because it will go on the insert
    // menu, so it just needs the word "Environment")
    editor.ui.registry.addMenuItem( 'environment', {
        icon : 'unselected',
        text : 'Environment',
        tooltip : 'Insert block representing an environment',
        shortcut : 'Meta+E',
        onAction : () => {
            editor.insertContent( Shell.createElement(
                editor, 'environment', editor.selection.getContent()
            ).outerHTML )
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
                    newPara.innerHTML = '&nbsp;'
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
                    newPara.innerHTML = '&nbsp;'
                    walk.parentNode.insertBefore( newPara, walk.nextSibling )
                    editor.selection.setCursorLocation( newPara, 0 )
                    editor.focus()
                    return
                }
            }
        }
    } )
}

export default { className, Shell, install }
