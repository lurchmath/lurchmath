
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting a dependecy-type atom into the document.  A user who edits such an
 * atom can load any document into that dependency from any source supported by
 * the {@link Dialog.loadFile Dialog.loadFile()} function.
 * 
 * Such an atom will have two important properties:
 * 
 *  * Its `"description"` metadata entry will contain whatever text the user
 *    wants to use to make the dependency easy to identify when scrolling
 *    through a document, so the reader doesn't need to open it up to know
 *    what's inside.  This is a simple piece of metadata, not HTML-type
 *    metadata; the difference between the two is documented
 *    {@link module:Atoms.Atom#getHTMLMetadata here}.
 *  * Its `"content"` HTML metadata entry will contain the full content of the
 *    dependency that was loaded, or it will be absent if the atom has not yet
 *    been configured by the user.  This is a piece of HTML metadata, not simple
 *    metadata, because it will typically be large; the difference between the
 *    two is documented {@link module:Atoms.Atom#getHTMLMetadata here}.
 * 
 * @module Dependencies
 */

import { Atom } from './atoms.js'
import { openFileInNewWindow } from './load-from-url.js'
import { simpleHTMLTable, escapeHTML } from './utilities.js'
import { Dialog, ButtonItem, TextInputItem } from './dialog.js'
import { addAutocompleteFunction } from './auto-completer.js'

/**
 * Install into a TinyMCE editor instance a new menu item: Import dependency,
 * intended for the Document menu.  It adds a dependency atom (with no content
 * or description) to the user's document, and if the user clicks it, they can
 * then edit both in a popup dialog.
 * 
 * This assumes that the TinyMCE initialization code includes the "dependency"
 * item on one of the menus.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'dependency', {
        icon : 'duplicate-row',
        text : 'Import dependency',
        tooltip : 'Insert block for importing a dependency',
        onAction : () => {
            const atom = Atom.newBlock( editor, '',
                { type : 'dependency', description : 'none' } )
            atom.update()
            atom.editThenInsert()
        }
    } )
    let emptyDependencyHTML = null
    addAutocompleteFunction( editor => {
        if ( !emptyDependencyHTML ) {
            const atom = Atom.newBlock( editor, '',
                { type: 'dependency', description : 'none' } )
            atom.update()
            emptyDependencyHTML = atom.getHTML()
        }
        return [
            {
                shortcut : 'dependency',
                preview : 'Import a dependency',
                content : emptyDependencyHTML
            }
        ]
    } )
}

// Internal use only: Show a dialog that lets the user edit the dependency's
// description, or change its content by loading any file over top of the old
// content, or preview the current content in a new window.
export class Dependency extends Atom {

    static subclassName = Atom.registerSubclass( 'dependency', Dependency )
    
    /**
     * Shows a multi-part dialog for editing dependency atoms, including
     * specfying their description and providing their content in any one of a
     * variety of ways.  The user can then confirm or cancel the edit,
     * as per the convention described in {@link module:Atoms.Atom#edit the
     * edit() function for the Atom class}.
     * 
     * @returns {Promise} same convention as specified in
     *   {@link module:Atoms.Atom#edit edit() for Atoms}
     */
    edit () {
        const description = this.getMetadata( 'description' )
        const origContent = this.getHTMLMetadata( 'content' )?.innerHTML
        let newContent = origContent
        const dialog = new Dialog( 'Edit dependency', this.editor )
        dialog.addItem( new TextInputItem( 'description', 'Description' ) )
        dialog.setDefaultFocus( 'description' )
        dialog.addItem( new ButtonItem( 'Load new contents (overwriting old)', () => {
            Dialog.loadFile( this.editor, 'Load dependency contents' )
            .then( loaded => newContent = loaded.content ) // save for below
            .catch( () => { } ) // it's ok to cancel
        } ) )
        dialog.addItem( new ButtonItem( 'Preview contents in new window', () => {
            openFileInNewWindow( newContent )
        } ) )
        dialog.setInitialData( { 'description' : description } )
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            this.setMetadata( 'description', dialog.get( 'description' ) )
            this.setHTMLMetadata( 'content', newContent ) // save loaded content
            this.update()
            return true
        } )
    }

    /**
     * Update the HTML representation of this dependency.  A dependency's
     * visual representation is just an uneditable DIV in the document that
     * looks like a box, says it's a dependency, and includes the description
     * the user provided when editing the dependency.  The actual content of the
     * dependency does not appear in its visual representation in the document,
     * because it would typically be prohibitively large.
     */
    update () {
        this.element.style.border = 'solid 1px gray'
        this.element.style.padding = '0 1em 0 1em'
        const description = this.getMetadata( 'description' )
        this.fillChild( 'body', simpleHTMLTable(
            'Imported dependency document',
            [ 'Description:', `<tt>${escapeHTML( description )}</tt>` ]
        ) )
    }

}

export default { install }
