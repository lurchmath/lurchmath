
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting a dependecy-type atom into the document.  A user who edits such an
 * atom can load any document into that dependency from any URL.
 * 
 * Such an atom will have three important properties:
 * 
 *  * A URL specifying where the dependency was loaded from.
 *  * A `"description"` metadata entry will contain whatever text the user
 *    wants to use to make the dependency easy to identify when scrolling
 *    through a document, so the reader doesn't need to open it up to know
 *    what's inside.  This is a simple piece of metadata, not HTML-type
 *    metadata; the difference between the two is documented
 *    {@link module:Atoms.Atom#getHTMLMetadata here}.
 *  * A `"content"` HTML metadata entry will contain the full content of the
 *    dependency that was loaded, or it will be absent if the atom has not yet
 *    been configured by the user.  This is a piece of HTML metadata, not simple
 *    metadata, because it will typically be large; the difference between the
 *    two is documented {@link module:Atoms.Atom#getHTMLMetadata here}.
 *  * A checkbox for whether the dependency should be refreshed every time the
 *    document is loaded.
 * 
 * @module Dependencies
 */

import { Atom, className } from './atoms.js'
import { openFileInNewWindow } from './load-from-url.js'
import { simpleHTMLTable, escapeHTML, escapeLatex } from './utilities.js'
import { Dialog, ButtonItem, TextInputItem, CheckBoxItem } from './dialog.js'
import { loadFromURL } from './load-from-url.js'

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
            const atom = Atom.newBlock( editor, '', {
                type : 'dependency',
                description : 'none',
                autoRefresh : false
            } )
            atom.update()
            atom.editThenInsert()
        }
    } )
    editor.ui.registry.addMenuItem( 'refreshdependencies', {
        icon : 'reload',
        text : 'Refresh dependencies',
        tooltip : 'Refresh all dependencies',
        onAction : () => {
            editor.setProgressState( true )
            Promise.all( [
                Dependency.refreshAllIn( editor.lurchMetadata ),
                Dependency.refreshAllIn( editor.getBody() )
            ] ).then( () => {
                editor.setProgressState( false )
                Dialog.notify( editor, 'success', 'Refreshed all dependencies.' )
            } ).catch( error => {
                editor.setProgressState( false )
                Dialog.notify( editor, 'error', error )
            } )
        }
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
        const origURL = this.getMetadata( 'filename' ) || '(not yet loaded)'
        const autoRefresh = this.getMetadata( 'autoRefresh' )
        let newContent = origContent
        let newURL = origURL
        const dialog = new Dialog( 'Edit dependency', this.editor )
        const tryToGetNewContent = () => new Promise( ( resolve, reject ) => {
            const urlInDialog = dialog.get( 'filename' )
            if ( newURL == urlInDialog && !!newContent ) {
                resolve()
            } else {
                const waitDialog = new Dialog( 'Loading file...', this.editor )
                waitDialog.hideFooter = true
                waitDialog.show()
                loadFromURL( urlInDialog ).then( content => {
                    waitDialog.close()
                    newContent = content
                    newURL = urlInDialog
                    dialog.dialog.setEnabled( 'OK', true )
                    resolve()
                } ).catch( error => {
                    waitDialog.close()
                    reject( error )
                } )
            }
        } )
        dialog.addItem(
            new TextInputItem( 'filename', 'Dependency loaded from:' ) )
        dialog.addItem( new ButtonItem( 'Preview current contents', () => {
            tryToGetNewContent().then( () => {
                openFileInNewWindow( newContent )
            } ).catch( error => {
                Dialog.failure(
                    this.editor,
                    'Could not load file from that URL',
                    'Could not dependency' )
                console.error( 'Could not load URL for this reason', error )
            } )
        } ) )
        dialog.addItem( new CheckBoxItem( 'autoRefresh',
            'Re-import every time the document loads' ) )
        dialog.addItem( new TextInputItem( 'description', 'Description' ) )
        dialog.setDefaultFocus( 'filename' )
        dialog.setInitialData( { filename : origURL, description, autoRefresh } )
        const result = dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            return tryToGetNewContent().then( () => {
                this.setMetadata( 'description', dialog.get( 'description' ) )
                this.setHTMLMetadata( 'content', newContent ) // save loaded content
                this.setMetadata( 'filename', newURL ) // and where it came from
                this.setMetadata( 'autoRefresh', dialog.get( 'autoRefresh' ) )
                this.update()
                return true
            } ).catch( error => {
                Dialog.failure(
                    this.editor,
                    'Could not load file from that URL',
                    'Could not dependency' )
                console.error( 'Could not load URL for this reason', error )
            } )
        } )
        dialog.dialog.setEnabled( 'OK', !!origContent )
        return result
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
        const filename = this.getMetadata( 'filename' )
        this.fillChild( 'body', simpleHTMLTable(
            'Imported dependency document',
            [ 'Description:', `<tt>${escapeHTML( description )}</tt>` ],
            [ 'Source:', `<tt>${escapeHTML( filename )}</tt>` ],
            [ 'Auto-refresh:', this.getMetadata( 'autoRefresh' ) ? 'yes' : 'no' ]
        ) )
    }

    /**
     * All atoms must be able to represent themselves in LaTeX form, so that the
     * document (or a portion of it) can be exporeted for use in a LaTeX editor,
     * such as Overleaf.  This function overrides the default implementation
     * with a representation suitable to dependency atoms.  It contains a single
     * line of text saying that a dependency is imported at this location,
     * followed by a bulleted list of the attributes of the dependency.
     * 
     * @returns {string} LaTeX representation of a dependency atom
     */
    toLatex () {
        return `Imported dependency document
        \\begin{enumerate}
        \\item  Description: ${escapeLatex( this.getMetadata( 'description' ) )}
        \\item  Source: \\url{${this.getMetadata( 'filename' )}}
        \\item  Auto-refresh: ${this.getMetadata( 'autoRefresh' ) ? 'yes' : 'no'}
        \\end{enumerate}
        `
    }

    /**
     * Get all top-level dependency atoms inside a given DOM node.
     * 
     * @param {Node} node - the DOM node in which to find Dependency atoms to
     *   refresh
     */
    static topLevelDependenciesIn ( node ) {
        // Find all elements inside the node representing dependency atoms
        const type = JSON.stringify( Dependency.subclassName )
        const allDepElts = Array.from( node.querySelectorAll(
            `.${className}[data-metadata_type='${type}']` ) )
        // Filter for just those that are top-level (not inside others)
        return allDepElts.filter( depElt =>
            !allDepElts.some( other =>
                other !== depElt && other.contains( depElt ) )
        ).map( depElt => Atom.from( depElt ) )
    }

    /**
     * Find all dependency atoms in the specified DOM node and refresh them.
     * The refreshing action on an individual dependency atom is done by the
     * {@link module:Dependencies.Dependency#refresh refresh()} function.
     * 
     * If the second parameter is true, then not all URL-based dependencies are
     * refreshed, but only those whose "auto-refresh" checkbox is checked.
     * 
     * This process is recursive, in that after all dependency atoms have been
     * refreshed, it will call itself again to refresh all dependency atoms
     * found inside any of the dependency atoms that were just refreshed.
     * 
     * @param {Node} node - the DOM node in which to find Dependency atoms to
     *   refresh
     * @param {boolean} autoRefreshOnly - whether to refresh only those atoms
     *   representing dependencies whose "auto-refresh" checkbox is checked
     * @returns {Promise} a promise that resolves if all refreshable dependency
     *   atoms successfully refreshed, and that rejects if any of them failed to
     *   refresh (e.g., page no longer at that URL, or a network error, etc.)
     * @see {@link module:Dependencies.Dependency#refresh refresh()}
     */
    static refreshAllIn ( node, autoRefreshOnly = false ) {
        return Promise.all( Dependency.topLevelDependenciesIn( node ).map(
            dependency => dependency.refresh( autoRefreshOnly ) ) )
    }

    /**
     * Refresh this dependency atom.  The auto-refresh checkbox need not be
     * checked; that is just for specifying whether this action should take
     * place every time the document loads.
     * 
     * This process is recursive, in that after the dependency atom has been
     * refreshed, it will call
     * {@link module:Dependencies.Dependency#refreshAllIn refreshAllIn()} to
     * refresh any dependencies inside the newly loaded content.  In doing so,
     * it will pass the argument of this function to specify whether that
     * recursion should apply to all URL-based dependencies, or just those whose
     * "auto-refresh" checkbox is checked.
     * 
     * @param {boolean} autoRefreshOnly - whether to ask recursive calls to
     *   apply to only dependencies whose "auto-refresh" checkbox is checked
     * @returns {Promise} a promise that resolves if the dependency was
     *   successfully refreshed, and that rejects if it failed to refresh
     *   (e.g., page no longer at that URL, or a network error, etc.)
     * @see {@link module:Dependencies.Dependency#refreshAllIn refreshAllIn()}
     */
    refresh ( autoRefreshOnly = false ) {
        return new Promise( ( resolve, reject ) => {
            loadFromURL( this.getMetadata( 'filename' ) ).then( content => {
                this.setHTMLMetadata( 'content', content )
                Dependency.refreshAllIn(
                    this.getHTMLMetadata( 'content' ), autoRefreshOnly
                ).then( resolve )
            } ).catch( reject )
        } )
    }

}

export default { install }
