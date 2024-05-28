
/**
 * Users who want to edit the invisible header inside of a Lurch document (which
 * is stored in its metadata) can do so in a second browser window (or tab)
 * containing a full Lurch document editor just for the header of the original
 * document.  In such a scheme, we call the first window (containing the whole
 * document) the *primary window* or *primary copy of the app* and the second
 * window (containing just the header from the primary window) *secondary
 * window* or *secondary copy of the app.*
 * 
 * This module adds features for both the primary and secondary copies of the
 * app.  For the primary window, it implements the tools for launching the
 * secondary window and sending it the header data.  For the secondary window,
 * it it implements the tools for limiting the UI elements to only what are
 * needed for the secondary copy of the app, and a function for passing the
 * edited header information back to the primary window upon request from the
 * user.
 * 
 * @module HeaderEditor
 */

import { appURL } from './utilities.js'
import { LurchDocument } from './lurch-document.js'
import { appSettings } from './settings-install.js'
import {
    Dialog, DialogRow, HTMLItem, ButtonItem, TextInputItem
} from './dialog.js'
import { Dependency } from './dependencies.js'
import { autoOpenLink } from './load-from-url.js'
import { Atom } from './atoms.js'

/**
 * The metadata element for a document is stored in the editor rather than the
 * DOM, because we do not want TinyMCE to be able to edit it.  It is sometimes
 * useful to be able to extract the header element from that metadata, so that
 * it can be treated like an entire document (fragment), since it effectively is\
 * one.
 * 
 * @param {tinymce.Editor} editor - the editor from which to extract the
 *   document header
 * @returns {HTMLElement} the HTMLElement that contains the document header
 *   for this editor
 * @function
 */
export const getHeader = editor =>
    new LurchDocument( editor ).getMetadata( 'main', 'header' )

// For internal use only:  Extract the header from the document metadata, as a
// string of HTML
const getHeaderHTML = editor => {
    const result = getHeader( editor )
    return result ? result.innerHTML : ''
}
// For internal use only:  Save the given HTML text into the document metadata
// as the document's header
export const setHeader = ( editor, header ) =>
    new LurchDocument( editor ).setMetadata( 'main', 'header', 'html', header )

// Internal constant used in URL query strings to tell a copy of the app that it
// has been opened for the sole purpose of being a header editor for a different
// copy of the app.  If this shows up in the query string, then the Lurch app
// being launched knows to configure itself differently to support header
// editing rather than full document editing.  In particular, "Save" should send
// the header back to the original document, not save it as a new document.
const headerFlag = 'editHeader'

/**
 * Detect whether the current copy of the app running in this window is the
 * secondary one, created in service to another (primary) window elsewhere.
 * In other words, return true if this is the secondary window and false if it
 * is the primary one.
 * 
 * @returns {boolean} whether this app window is for editing the document
 *   header from a separate (primary) Lurch app window
 * @function
 */
export const isEditor = () =>
    new URL( window.location ).searchParams.get( headerFlag ) == 'true'

/**
 * Detect whether the current copy of the app running in this window is the
 * primary window *and also* currently has a secondary window open for editing
 * this window's header.
 * 
 * @returns {boolean} whether this app window has a secondary window open for
 *   editing the header in this window's document
 */
export const hasEditorOpen = () =>
    window.headerEditorWindow && !window.headerEditorWindow.closed

/**
 * Install into a TinyMCE editor instance the menu items that can be used in
 * the primary window to pop open the secondary window, or instead to move
 * content between the header and the main document.  The menu items in question
 * are intended for the Document menu, but could be placed anywhere.
 * 
 * @param {tinymce.editor} editor - the TinyMCE editor into which to install the
 *   tools
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'editheader', {
        text : 'Edit document header in new window',
        icon : 'new-tab',
        tooltip : 'Edit document header',
        onAction : () => {
            if ( hasEditorOpen() )
                return Dialog.notify( editor, 'warning',
                    'You are already editing this document\'s header in another window.' )
            window.headerEditorWindow = window.open(
                `${appURL()}?${headerFlag}=true`, '_blank' )
            // We cannot tell when the header editor window is ready to receive
            // messages, so we have to retry sending our content until either it
            // lets us know that it received it, or the tab closes.
            const interval = setInterval( () => {
                if ( window.closed ) {
                    clearInterval( interval )
                    return
                }
                window.headerEditorWindow.postMessage(
                    getHeaderHTML( editor ), appURL() )
            }, 1000 )
            window.addEventListener( 'message', event => {
                if ( event.source != window.headerEditorWindow ) return
                // if it's a message saying they received our content, stop
                // trying to send it
                if ( event.data == 'content received' ) {
                    clearInterval( interval )
                    return
                }
                // otherwise, assume it's a "save" message with new content,
                // because the user edited the header in the other window and
                // then saved, which sends it back to us
                setHeader( editor, event.data )
                Dialog.notify( editor, 'success', 'Header updated from other window.', 5000 )
            }, false )
        }
    } )
    editor.ui.registry.addMenuItem( 'extractheader', {
        text : 'Move header into document',
        icon : 'chevron-down',
        tooltip : 'Extract header to top of document',
        onAction : () => {
            if ( hasEditorOpen() )
                return Dialog.notify( editor, 'error',
                    'You cannot extract the header while editing it in another window.' )
            const header = getHeaderHTML( editor )
            if ( header == '' )
                return Dialog.notify( editor, 'warning',
                    'This document\'s header is currently empty.' )
            appSettings.load()
            appSettings.showWarning( 'warn before extract header', editor )
            .then( userSaidToProceed => {
                if ( !userSaidToProceed ) return
                editor.selection.setCursorLocation() // == start
                editor.insertContent( header )
                setHeader( editor, '' )
                editor.undoManager.clear()
            } )
        }
    } )
    editor.ui.registry.addMenuItem( 'embedheader', {
        text : 'Move selection to end of header',
        icon : 'chevron-up',
        tooltip : 'Embed selection from document to end of header',
        onAction : () => {
            if ( hasEditorOpen() )
                return Dialog.notify( editor, 'error',
                    'You cannot extract the header while editing it in another window.' )
            const toEmbed = editor.selection.getContent()
            if ( hasEditorOpen() )
                return Dialog.notify( editor, 'error',
                    'You do not currently have any content selected.' )
            appSettings.load()
            appSettings.showWarning( 'warn before embed header', editor )
            .then( userSaidToProceed => {
                if ( !userSaidToProceed ) return
                setHeader( editor, getHeaderHTML( editor ) + toEmbed )
                editor.execCommand( 'delete' )
                editor.undoManager.clear()
            } )
        }
    } )
    editor.ui.registry.addMenuItem( 'editdependencyurls', {
        text : 'Edit background material',
        tooltip : 'Edit the list of documents on which this one depends',
        icon : 'edit-block',
        onAction : () => {
            // Get all dependency information from the document
            let header = getHeader( editor ) // important! this is a clone!
            const relevantDependencies = !header ? [ ] :
                Dependency.topLevelDependenciesIn( header ).filter(
                    dependency => dependency.getMetadata( 'source' ) == 'web' )
            const chosenDependencyURLs = relevantDependencies.map(
                dependency => dependency.getMetadata( 'filename' ) )
            // Create the dialog, but it is a dynamic dialog, so we do not
            // populate it directly, but instead create functions that will do
            // so as needed.
            const dialog = new Dialog( 'Edit background material', editor )
            // This first function handles the width of column 1 in the dialog's
            // rows, to improve aesthetics.  It must be called after each
            // dynamic update to the dialog.  (See calls below.)
            const touchUpDialogDOM = () => {
                dialog.querySelector( 'input[type="text"]' )
                    .classList.add( 'expand-this' )
                ;[ ...dialog.querySelectorAll( '.expand-this' ) ].forEach(
                    node => node.parentNode.style.width = '100%' )
            }
            // This function clears out all dialog content and repopulates the
            // dialog based on which dependency URLs are currently chosen.
            // The list of dependency URLs starts out as whatever the document
            // currently contains, as computed above, but will be edited over
            // time by the user, using this dialog, before hitting OK or Cancel.
            const fillDialog = () => {
                while ( dialog.items.length > 0 ) dialog.removeItem( 0 )
                dialog.addItem( new HTMLItem( 'Existing background material:' ) )
                // Add 0 or more rows, one for each URL:
                if ( chosenDependencyURLs.length == 0 ) {
                    dialog.addItem( new HTMLItem( '(none)' ) )
                } else {
                    chosenDependencyURLs.forEach( ( url, index ) => {
                        dialog.addItem( new DialogRow(
                            new HTMLItem( `<code class="expand-this">${url}</code>` ),
                            new ButtonItem(
                                'View',
                                () => window.open( autoOpenLink( url ), '_blank' ),
                                `view${index}`
                            ),
                            new ButtonItem(
                                'Remove',
                                () => {
                                    chosenDependencyURLs.splice( index, 1 )
                                    fillDialog()
                                    dialog.reload()
                                    touchUpDialogDOM()
                                },
                                `remove${index}`
                            )
                        ) )
                    } )
                }
                // Add controls for adding another URL:
                dialog.addItem( new HTMLItem( '&nbsp;' ) )
                dialog.addItem( new HTMLItem( 'To add new background material:' ) )
                dialog.addItem( new DialogRow(
                    new TextInputItem(
                        'new_url', '', 'Enter URL here' ),
                    new ButtonItem( 'Add', () => {
                        const newURL = dialog.get( 'new_url' )
                        if ( newURL.trim() == '' ) return
                        chosenDependencyURLs.push( newURL )
                        fillDialog()
                        dialog.reload()
                        touchUpDialogDOM()
                    } )
                ) )
                dialog.setDefaultFocus( 'new_url' )
            }
            // Call the above function to populate the dialog for the first time.
            fillDialog()
            // Show the dialog then handle what happens when the user does Cancel/OK.
            dialog.show().then( userHitOK => {
                if ( !userHitOK ) return
                // The user hit OK, so we make changes to the document.
                // If it doesn't have a header, create a new, empty one.
                // Note that `header` is a DOM clone of the actual header!
                if ( !header ) {
                    setHeader( editor, '' )
                    header = getHeader( editor )
                }
                // Delete any old dependency atoms from the (copy of the) header:
                relevantDependencies.forEach(
                    dependency => dependency.element.remove() )
                // Add the new list of dependency atoms to the end of the
                // (copy of the) header:
                chosenDependencyURLs.forEach( url => {
                    const newDependency = Atom.newBlock( editor, '', {
                        type : 'dependency',
                        description : 'none',
                        filename : url,
                        source : 'web',
                        content : '', // will be populated later; see below
                        autoRefresh : true
                    } )
                    newDependency.update()
                    header.appendChild( newDependency.element )
                } )
                // Because "header" is a clone of the actual header, the
                // in-place edits above did not touch the actual document,
                // so we must do the following to "save" our changes:
                setHeader( editor, header.innerHTML )
                // This is the code that recursively populates header dependencies:
                // (It is a bit of a hack because we are using the "private"
                // method findMetadataElement(), but it's what we need.)
                const savedHeader = new LurchDocument( editor )
                    .findMetadataElement( 'main', 'header' )
                Dependency.refreshAllIn( savedHeader ).then( () => {
                    Dialog.notify( editor, 'success',
                        'Refreshed all background material from the web.',
                        5000 )
                } ).catch( error => {
                    Dialog.notify( editor, 'error',
                        'Could not refresh all background material from the web.' )
                    console.log( 'Error when refreshing background material',
                        error )
                } )
            } )
            // Now that we've shown the dialog for the first time,
            // do the necessary tweaks to make its aesthetics right:
            touchUpDialogDOM()
        }
    } )
    editor.ui.registry.addMenuItem( 'viewdependencyurls', {
        text : 'Show/hide rules',
        icon : 'character-count',
        shortcut : 'meta+alt+0',
        tooltip : 'View the mathematical content on which this document depends',
        onAction : () => {
            // If there are preview atoms in the document, remove them and be done
            const existingPreviews = Atom.allIn( editor ).filter(
                atom => atom.getMetadata( 'type' ) == 'preview' )
            if ( existingPreviews.length > 0 ) {
                existingPreviews.forEach( preview => preview.element.remove() )
                editor.selection.setCursorLocation(editor.getBody(),0)
                return
            }
            // If not, we have to create them from the content in the header.
            // If there is no content in the header, report that and be done.
            const header = getHeader( editor )
            if ( !header ) {
                Dialog.notify( editor, 'warning',
                    'This document does not import any background material.',
                    5000 )
                return
            }
            // Accumulate the HTML representation of all previews of all
            // dependencies in the header.
            let allPreviewHTML = ''
            Dependency.topLevelDependenciesIn( header ).forEach( dependency => {
                const preview = Atom.newBlock( editor, '', { type : 'preview' } )
                preview.imitate( dependency )
                allPreviewHTML += preview.element.outerHTML
            } )
            // Insert it into the document.
            editor.selection.setCursorLocation() // == start
            editor.insertContent( allPreviewHTML )
            editor.undoManager.clear()
            editor.selection.setCursorLocation() // deselect new insertions
        }
    } )
}

/**
 * Assuming that we're in the secondary copy of the app, listen for the message
 * from the primary window that sends us the header to edit, and when we receive
 * it, populate our editor with it.  While we wait, our editor is read only and
 * says "Loading header..." so that the user knows to wait.
 * 
 * Also, install a new File > Save action that will send our editor's content
 * back to the primary window so that it can store that updated content in its
 * document header.
 * 
 * @param {tinymce.editor} editor - the TinyMCE editor into which to load the
 *   header data, once we receive it from the primary window
 * @function
 */
export const listen = editor => {
    let mainEditor = null
    editor.setContent( 'Loading header...' )
    editor.mode.set( 'readonly' )
    window.addEventListener( 'message', event => {
        if ( !appURL().startsWith( event.origin ) ) return
        mainEditor = event.source
        new LurchDocument( editor ).newDocument()
        editor.setContent( event.data )
        editor.mode.set( 'design' )
        Dialog.notify( editor, 'success',
            'Opened header data for editing.\nDon\'t forget to save before closing.' )
        mainEditor.postMessage( 'content received', appURL() )
    }, false )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        tooltip : 'Save header into original document',
        icon : 'save',
        shortcut : 'meta+S',
        onAction : () => {
            if ( !mainEditor ) return
            mainEditor.postMessage( editor.getContent(), appURL() )
        }
    } )
}

export default { isEditor, hasEditorOpen, install, listen }
