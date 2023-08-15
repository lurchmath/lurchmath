
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

// For internal use only:  Extract the header from the document metadata, as a
// string of HTML
const getHeader = editor => {
    const result = new LurchDocument( editor ).getMetadata( 'main', 'header' )
    return result ? result.innerHTML : ''
}
// For internal use only:  Save the given HTML text into the document metadata
// as the document's header
const setHeader = ( editor, header ) =>
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
export const isHeaderEditor = () =>
    new URL( window.location ).searchParams.get( headerFlag ) == 'true'

/**
 * Detect whether the current copy of the app running in this window is the
 * primary window *and also* currently has a secondary window open for editing
 * this window's header.
 * 
 * @returns {boolean} whether this app window has a secondary window open for
 *   editing the header in this window's document
 */
export const hasHeaderEditorOpen = () =>
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
export const installHeaderEditor = editor => {
    editor.ui.registry.addMenuItem( 'editheader', {
        text : 'Edit document header in new window',
        icon : 'new-tab',
        tooltip : 'Edit document header',
        onAction : () => {
            if ( hasHeaderEditorOpen() ) {
                editor.notificationManager.open( {
                    type : 'warning',
                    text : 'You are already editing this document\'s header in another window.'
                } )
                return
            }
            window.headerEditorWindow = window.open(
                `${appURL()}?${headerFlag}=true`, '_blank' )
            window.headerEditorWindow.addEventListener( 'load', () =>
                window.headerEditorWindow.postMessage(
                    getHeader( editor ), appURL() ) )
            window.addEventListener( 'message', event => {
                if ( event.source != window.headerEditorWindow ) return
                setHeader( editor, event.data )
                editor.notificationManager.open( {
                    type : 'success',
                    text : 'Header updated from other window.',
                    timeout : 5000
                } )
            }, false )
        }
    } )
    editor.ui.registry.addMenuItem( 'extractheader', {
        text : 'Move header into document',
        icon : 'chevron-down',
        tooltip : 'Extract header to top of document',
        onAction : () => {
            if ( hasHeaderEditorOpen() ) {
                editor.notificationManager.open( {
                    type : 'error',
                    text : 'You cannot extract the header while editing it in another window.'
                } )
                return
            }
            const header = getHeader( editor )
            if ( header == '' ) {
                editor.notificationManager.open( {
                    type : 'warning',
                    text : 'This document\'s header is currently empty.'
                } )
                return
            }
            appSettings.load()
            appSettings.showWarning( 'warn before extract header', editor )
            .then( () => {
                editor.selection.setCursorLocation() // == start
                editor.insertContent( header )
                setHeader( editor, '' )
                editor.undoManager.clear()
            } )
            .catch( () => { } )
        }
    } )
    editor.ui.registry.addMenuItem( 'embedheader', {
        text : 'Move selection to end of header',
        icon : 'chevron-up',
        tooltip : 'Embed selection from document to end of header',
        onAction : () => {
            if ( hasHeaderEditorOpen() ) {
                editor.notificationManager.open( {
                    type : 'error',
                    text : 'You cannot extend the header while editing it in another window.'
                } )
                return
            }
            const toEmbed = editor.selection.getContent()
            if ( toEmbed == '' ) {
                editor.notificationManager.open( {
                    type : 'warning',
                    text : 'You do not currently have any content selected.'
                } )
                return
            }
            appSettings.load()
            appSettings.showWarning( 'warn before embed header', editor )
            .then( () => {
                setHeader( editor, getHeader( editor ) + toEmbed )
                editor.execCommand( 'delete' )
                editor.undoManager.clear()
            } )
            .catch( () => { } )
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
export const listenForHeader = editor => {
    let mainEditor = null
    editor.setContent( 'Loading header...' )
    editor.mode.set( 'readonly' )
    window.addEventListener( 'message', event => {
        if ( !appURL().startsWith( event.origin ) ) return
        mainEditor = event.source
        editor.setContent( event.data )
        editor.mode.set( 'design' )
        editor.notificationManager.open( {
            type : 'success',
            text : 'Opened header data for editing.\nDon\'t forget to save before closing.',
            timeout : 2000
        } )
    }, false )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        tooltip : 'Save header into original document',
        icon : 'save',
        shortcut : 'meta+S',
        onAction : () => {
            console.log( mainEditor, editor.getContent() )
            if ( !mainEditor ) return
            mainEditor.postMessage( editor.getContent(), appURL() )
        }
    } )
}
