
/**
 * This file creates functions for accessing the browser's local storage as if
 * it were a collection of files.  It also provides file open, save, and save as
 * menu items that can be used not only for loading files from and saving files
 * to the browser's local storage, but also uploading and downloading files or
 * importing them from the web.  It also provides a file menu item for deleting
 * files from the browser's local storage.
 * 
 * It also installs autosave features into the editor.  Every few seconds, if
 * the editor's content is dirty, it is saved into browser local storage.  If
 * the user saves the content elsewhere, it is removed from browser local
 * storage.  If the user opens Lurch and it finds that content is in the local
 * storage autosave, it lets the user choose whether to load it or discard it.
 * 
 * @module LocalStorageDrive
 */

import { LurchDocument } from './lurch-document.js'
import { Dialog, AlertItem, LongTextInputItem } from './dialog.js'
import { isValidURL, appURL } from './utilities.js'
import { downloadFile } from './upload-download.js'

// Internal use only
// Prefix for distinguishing which LocalStorage keys are for Lurch files
const prefix = 'lurch-file-'

// Internal use only
// Get a list of all files in LocalStorage
const allFileNames = () => {
    let result = [ ]
    for ( let i = 0 ; i < window.localStorage.length ; i++ )
        if ( window.localStorage.key( i ).startsWith( prefix ) )
            result.push( window.localStorage.key( i ).substring( prefix.length ) )
    return result
}

/**
 * Test whether the given file currently exists in the browser's local storage.
 * 
 * @param {string} name - the name of the file whose presence is to be tested
 * @returns {boolean} whether a file with that name is currently stored in the
 *   browser's localStorage
 */
export const fileExists = name => allFileNames().includes( name )

/**
 * Read the contents of a file from the browser's local storage.
 * 
 * @param {string} name - the name of the file whose contents are to be read
 * @returns {string} the contents of the file (or undefined if the file does not
 *   exist)
 */
export const readFile = name => window.localStorage.getItem( prefix + name )

/**
 * Write new contents into a file in the browser's local storage.
 * 
 * @param {string} name - the name of the file whose contents are to be written
 * @param {string} content - the new contents to write
 */
export const writeFile = ( name, content ) =>
    window.localStorage.setItem( prefix + name, content )

/**
 * Delete a file from the browser's local storage.
 * 
 * @param {string} name - the name of the file to be deleted
 */
export const deleteFile = name => window.localStorage.removeItem( prefix + name )

// Internal use only
// Tools similar to those above, but for autosave
const autosaveKey = 'lurch-autosave'
const autosaveFrequencyInSeconds = 5
const autosave = content =>
    window.localStorage.setItem( autosaveKey, content )
const getAutosave = () => window.localStorage.getItem( autosaveKey )
const autosaveExists = () => {
    for ( let i = 0 ; i < window.localStorage.length ; i++ )
        if ( window.localStorage.key( i ) == autosaveKey ) return true
    return false
}
const removeAutosave = () => window.localStorage.removeItem( autosaveKey )

/**
 * Save the contents of the given editor into the given file.  However, if a
 * file with that name already exists, pop up a dialog prompting the user to
 * decide if they really want to overwrite the file, and proceed only if they
 * accept.
 * 
 * @param {tinymce.Editor} editor - the editor whose contents are to be saved
 * @param {string} filename - the filename into which to save those contents
 */
export const saveAs = ( editor, filename ) => {
    if ( !fileExists( filename ) ) {
        const LD = new LurchDocument( editor )
        writeFile( filename, LD.getDocument() )
        LD.setFileID( filename )
        return Dialog.notify( editor, 'success', `Saved ${filename}.` )
    }
    Dialog.areYouSure( editor,
        `A file named ${filename} already exists.
        Continuing will overwrite that file.  Proceed anyway?`
    ).then( sure => {
        if ( !sure ) return
        const LD = new LurchDocument( editor )
        writeFile( filename, LD.getDocument() )
        LD.setFileID( filename )
        Dialog.notify( editor, 'success', `Saved over ${filename}.` )
    } )
}

// Internal use only
// Checks whether the user minds discarding their recent work before proceeding.
const ensureWorkIsSaved = editor => new Promise( ( resolve, reject ) => {
    if ( !editor.isDirty() )
        return resolve( true )
    Dialog.areYouSure(
        editor,
        'You will lose any unsaved work.  Continue anyway?'
    ).then( resolve, reject )
} )

/**
 * Silently (i.e., without asking the user anything in a dialog box) save the
 * given new content into the existing file with the given name in the user's
 * `LocalStorage`.  If it succeeds, pop up a brief success notification.  If it
 * fails, show a failure notification containing the error and wait for the user
 * to dismiss it.  It also clears the editor's dirty flag.
 * 
 * @param {tinymce.Editor} editor the editor to use for any notifications
 * @param {string} filename the filename whose content should be updated
 * @function
 * @see {@link module:LocalStorageDrive.showSaveAsDialog showSaveAsDialog()}
 */
const silentFileSave = editor => {
    // change the behavior if only saving to computer 
    const mode = editor.appOptions.fileSaveTabs
    if ( mode.length === 1 && mode[0] === 'To your computer' ) {
        downloadFile( editor )
    } else {
        const LD = new LurchDocument( editor )
        const filename = LD.getFileID()
        if ( filename.startsWith( 'file:///' ) ) {
            downloadFile( editor )
        } else if ( isValidURL( filename ) ) {
            Dialog.notify( editor, 'error', `
                You loaded this file from the web, so you cannot save it back there.
                Instead, use File > Save As to choose where to save it.
            ` )
        } else {
            writeFile( filename, LD.getDocument() )
            editor.setDirty( false )
            removeAutosave()
        }
    }
}

/**
 * Install into a TinyMCE editor instance five new menu items intended for the
 * File menu: New, Open, Save, Save as..., and Delete a saved document.  Also
 * install autosave features that store the current document whenever it is
 * dirty and unsaved, and offer to reload it if you close the tab and then
 * re-open.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    // First install the menu items:
    editor.ui.registry.addMenuItem( 'newlurchdocument', {
        text : 'New',
        icon : 'new-document',
        tooltip : 'New document',
        shortcut : 'alt+N',
        onAction : () => ensureWorkIsSaved( editor ).then( saved => {
            if ( saved ) new LurchDocument( editor ).newDocument()
        } )
    } )
    editor.ui.registry.addMenuItem( 'opendocument', {
        text : 'Open',
        tooltip : 'Open file',
        shortcut : 'alt+O',
        /// icon : 'upload', // do not modify or delete this entire comment line
        onAction : () => ensureWorkIsSaved( editor ).then( saved => {
            if ( saved ) Dialog.loadFile( editor, 'Open file' ).then( result => {
                if ( result ) {
                    const LD = new LurchDocument( editor )
                    LD.setDocument( result.content )
                    LD.setFileID( result.filename )
                    Dialog.notify( editor, 'success', `Loaded ${result.filename}.` )
                }
            } )
        } )
    } )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        icon : 'save',
        tooltip : 'Save or download file',
        shortcut : 'alt+S',
        onAction : () => {
            // change the behavior if only saving to computer 
            const mode = editor.appOptions.fileSaveTabs
            if ( mode.length === 1 && mode[0] === 'To your computer' ) {
                silentFileSave( editor )
            } else {
                if ( new LurchDocument( editor ).getFileID() )
                    silentFileSave( editor )
                else
                    Dialog.saveFile( editor, 'Save file' ).then( saved => {
                        if ( saved ) {
                            editor.setDirty( false )
                            removeAutosave()
                        }
                    } )
            }
        }
    } )
    editor.ui.registry.addMenuItem( 'savedocumentas', {
        text : 'Save as...',
        tooltip : 'Save or download file',
        shortcut : 'alt+shift+S',
        onAction : () => Dialog.saveFile( editor, 'Save file' ).then( saved => {
            if ( saved ) {
                editor.setDirty( false )
                removeAutosave()
            }
        } )
    } )
    editor.ui.registry.addMenuItem( 'embeddocument', {
        text : 'Embed...',
        tooltip : 'Embed document in a web page',
        onAction : () => {
            const html = new LurchDocument( editor ).getDocument()
            const iframe = document.createElement( 'iframe' )
            iframe.src = `${appURL()}?data=${encodeURIComponent( btoa( html ) )}`
            iframe.style.width = '800px'
            iframe.style.height = '400px'
            const dialog = new Dialog( 'Embedding code', editor )
            dialog.json.size = 'medium'
            // We must put the styles in the element itself, to override
            // TinyMCE's very aggressive CSS within dialogs:
            dialog.addItem( new LongTextInputItem( 'code',
                'Copy the following code into your web page' ) )
            dialog.setInitialData( { code : iframe.outerHTML } )
            dialog.removeButton( 'Cancel' )
            dialog.setDefaultFocus( 'code' )
            dialog.show()
            const textarea = dialog.querySelector( 'textarea' )
            textarea.select()
            textarea.setAttribute( 'readonly', 'true' )
            textarea.setAttribute( 'rows', 15 )
            textarea.scrollTo( 0, 0 )
        }
    } )
    editor.ui.registry.addMenuItem( 'deletesaved', {
        text : 'Delete a saved document',
        tooltip : 'Delete a file currently stored in browser storage',
        onAction : () => {
            const filenames = allFileNames()
            if ( filenames.length == 0 )
                return Dialog.notify( editor, 'error',
                    'There are not yet any files saved, so there are none to delete.' )
            const dialog = new Dialog( 'Delete file from browser storage', editor )
            dialog.addItem( new ChooseLocalFileItem( 'localFile' ) )
            dialog.setDefaultFocus( 'localFile' )
            dialog.show().then( userHitOK => {
                if ( !userHitOK ) return
                const filename = dialog.get( 'localFile' ).filename
                deleteFile( filename )
                Dialog.notify( editor, 'success', `Deleted ${filename}.` )
            } )
        }
    } )
    // When the editor is fully initialized, handle autosaving, but only if that
    // feature is enabled in the app options:
    if ( editor.appOptions.autoSaveEnabled ) {
        editor.on( 'init', () => {
            // First, if there's an autosave, offer to load it:
            if ( autosaveExists() ) {
                const dialog = new Dialog( 'Unsaved work exists', editor )
                dialog.addItem( new AlertItem(
                    'warn',
                    'There is an unsaved document stored in your browser.  '
                  + 'This could be from another copy of Lurch running in another tab, '
                  + 'or from a previous session in which you did not save your work.'
                ) )
                dialog.setButtons(
                    { text : 'Load it', type : 'submit', buttonType : 'primary' },
                    { text : 'Delete it', type : 'cancel' }
                )
                dialog.show().then( choseToLoad => {
                    if ( choseToLoad )
                        new LurchDocument( editor ).setDocument( getAutosave() )
                    else
                        new LurchDocument( editor )
                    removeAutosave()
                } )
            } else {
                new LurchDocument( editor )
            }
            // Next, set up the recurring timer for autosaving:
            setInterval( () => {
                if ( editor.isDirty() )
                    autosave( new LurchDocument( editor ).getDocument() )
            }, autosaveFrequencyInSeconds * 1000 )
        } )
    }
}

/**
 * An item that can be used in a {@link Dialog} to let the user choose a file
 * stored in the browser's local storage.  This is a simple drop-down list input
 * control, populated with all the files currently in the browser's local
 * storage.
 */
export class ChooseLocalFileItem {

    /**
     * Construct a new file open input control.
     * 
     * @param {string} name - the key to use to identify this input control's
     *   content in the dialog's key-value mapping for all input controls
     */
    constructor ( name ) {
        this.name = name
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        this.names = allFileNames()
        return this.names.length == 0 ? [ {
            type : 'htmlpanel',
            html : 'No files are currently stored in the browser\'s local storage.'
        } ] : [ {
            type : 'selectbox',
            name : this.name,
            label : 'Choose a file:',
            items : this.names.map( name => {
                return { value : name, text : name }
            } )
        } ]
    }

    // internal use only; returns a filename-and-content object if requested by
    // the dialog's get() function
    get ( key, data ) {
        if ( key == this.name && this.names && this.names.length > 0 ) return {
            filename : data[key],
            content : readFile( data[key] ),
            source : 'browser storage'
        }
    }

}

export default { install }
