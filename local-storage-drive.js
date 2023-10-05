
/**
 * This file creates simple TinyMCE dialog boxes and simple functions to access
 * them, to make it easy to provide file open, save, and save-as functionality
 * that work only within the browser's `LocalStorage`.  This is a drop-in
 * replacement for the {@link module:GoogleDriveUI Google Drive UI}, which has
 * been quite unstable and we therefore sometimes need to disable it until we
 * can fully debug its problems.
 * 
 * @module LocalStorageDrive
 */

import { LurchDocument } from './lurch-document.js'

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

// Internal use only
// Test whether a file with the given name exists
const fileExists = name => readFile( name ) !== null

// Internal use only
// Read file content from a given filename
const readFile = name => window.localStorage.getItem( prefix + name )

// Internal use only
// Write file content to a given filename
const writeFile = ( name, content ) =>
    window.localStorage.setItem( prefix + name, content )

// Internal use only
// Delete file from browser LocalStorage
const deleteFile = name => window.localStorage.removeItem( prefix + name )

/**
 * Show a file open dialog box viewing the files in the user's `LocalStorage`.
 * If the user picks a file from it, load that file into the given TinyMCE
 * editor.  If an error occurs, pop up a notification in the editor stating that
 * an error occurred opening the file.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the
 *   file will be loaded, if the user chooses one
 * @function
 * @see {@link module:LocalStorageDrive.showSaveAsDialog showSaveAsDialog()}
 */
const showFileOpenDialog = editor => {
    const filenames = allFileNames()
    if ( filenames.length == 0 ) {
        editor.notificationManager.open( {
            type : 'error',
            text : 'There are not yet any files saved, so there are none to open.'
        } )
        return
    }
    const dialog = editor.windowManager.open( {
        title : 'Open file from browser storage',
        body : {
            type : 'panel',
            items : [
                {
                    type : 'selectbox',
                    name : 'filename',
                    label : 'Choose the file to open:',
                    items : filenames.map( name => {
                        return { value : name, text : name }
                    } )
                }
            ]
        },
        buttons : [
            {
                type : 'submit',
                text : 'Open selected file',
                buttonType : 'primary'
            },
            {
                type : 'cancel',
                text : 'Cancel',
            }
        ],
        onSubmit : () => {
            const filename = dialog.getData()['filename']
            const LD = new LurchDocument( editor )
            LD.setDocument( readFile( filename ) )
            LD.setFileID( filename )
            dialog.close()
            editor.notificationManager.open( {
                type : 'success',
                text : `Loaded ${filename}.`,
                timeout : 2000
            } )
        }
    } )
}

/**
 * Show the user a filename entry dialog box.  If they type a filename and
 * choose to save, the contents of the given editor are written into that file
 * in the user's `LocalStorage`.  If it would overwrite an existing file, pop up
 * a warning first to ensure that the user really wants to do that.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance whose content
 *   should be saved under the filename the user chooses
 * @function
 * @see {@link module:LocalStorageDrive.showFileOpenDialog showFileOpenDialog()}
 * @see {@link module:LocalStorageDrive.silentFileSave silentFileSave()}
 * @see {@link module:LocalStorageDrive.showDeleteDialog showDeleteDialog()}
 */
const showSaveAsDialog = editor => {
    const dialog = editor.windowManager.open( {
        title : 'Choose filename under which to save',
        body : {
            type : 'panel',
            items : [
                {
                    type : 'input',
                    name : 'filename',
                    label : 'Filename',
                    maximized : true
                }
            ],
        },
        buttons : [
            { text : 'Save', type : 'submit', buttonType : 'primary' },
            { text : 'Cancel', type : 'cancel' }
        ],
        initialData : {
            filename : new LurchDocument( editor ).getFileID() || ''
        },
        onSubmit : () => {
            const filename = dialog.getData()['filename']
            dialog.close()
            if ( !fileExists( filename ) ) {
                const LD = new LurchDocument( editor )
                writeFile( filename, LD.getDocument() )
                LD.setFileID( filename )
                editor.notificationManager.open( {
                    type : 'success',
                    text : `Saved ${filename}.`,
                    timeout : 2000
                } )
                return
            }
            const warningDialog = editor.windowManager.open( {
                title : 'Overwrite existing file?',
                body : {
                    type : 'panel',
                    items : [
                        {
                            type : 'alertbanner',
                            level : 'warn',
                            icon : 'warning',
                            text : `A file named ${filename} already exists.  Overwrite it?`
                        }
                    ]
                },
                buttons : [
                    { text : 'Overwrite and save', type : 'submit' },
                    { text : 'Cancel', type : 'cancel' }
                ],
                onSubmit : () => {
                    const LD = new LurchDocument( editor )
                    writeFile( filename, LD.getDocument() )
                    LD.setFileID( filename )
                    warningDialog.close()
                    editor.notificationManager.open( {
                        type : 'success',
                        text : `Saved over ${filename}.`,
                        timeout : 2000
                    } )
                }
            } )
        }
    } )
}

/**
 * Show a file open dialog box viewing the files in the user's `LocalStorage`.
 * If the user picks a file from it, delete that file from the user's storage.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance that should be
 *   used to create the dialog
 * @function
 * @see {@link module:LocalStorageDrive.showSaveAsDialog showSaveAsDialog()}
 */
const showDeleteDialog = editor => {
    const filenames = allFileNames()
    if ( filenames.length == 0 ) {
        editor.notificationManager.open( {
            type : 'error',
            text : 'There are not yet any files saved, so there are none to delete.'
        } )
        return
    }
    const dialog = editor.windowManager.open( {
        title : 'Delete file from browser storage',
        body : {
            type : 'panel',
            items : [
                {
                    type : 'selectbox',
                    name : 'filename',
                    label : 'Choose the file to delete:',
                    items : filenames.map( name => {
                        return { value : name, text : name }
                    } )
                },
                {
                    type : 'alertbanner',
                    level : 'warn',
                    icon : 'warning',
                    text : 'This action cannot be undone.'
                }
    ]
        },
        buttons : [
            {
                type : 'submit',
                text : 'Permanently delete selected file',
                buttonType : 'primary'
            },
            {
                type : 'cancel',
                text : 'Cancel',
            }
        ],
        onSubmit : () => {
            const filename = dialog.getData()['filename']
            deleteFile( filename )
            editor.notificationManager.open( {
                type : 'success',
                text : `Deleted ${filename}.`,
                timeout : 2000
            } )
            dialog.close()
        }
    } )
}

/**
 * Silently (i.e., without asking the user anything in a dialog box) save the
 * given new content into the existing file with the given name in the user's
 * `LocalStorage`.  If it succeeds, pop up a brief success notification.  If it
 * fails, show a failure notification containing the error and wait for the user
 * to dismiss it.
 * 
 * @param {tinymce.Editor} editor the editor to use for any notifications
 * @param {string} filename the filename whose content should be updated
 * @function
 * @see {@link module:LocalStorageDrive.showSaveAsDialog showSaveAsDialog()}
 */
const silentFileSave = editor => {
    const LD = new LurchDocument( editor )
    writeFile( LD.getFileID(), LD.getDocument() )
}

export const install = editor => {
    editor.ui.registry.addMenuItem( 'newlurchdocument', {
        text : 'New',
        icon : 'new-document',
        tooltip : 'New document',
        shortcut : 'meta+N',
        onAction : () => new LurchDocument( editor ).newDocument()
    } )
    editor.ui.registry.addMenuItem( 'opendocument', {
        text : 'Open',
        tooltip : 'Open file from browser storage',
        shortcut : 'meta+O',
        onAction : () => showFileOpenDialog( editor )
    } )
    editor.ui.registry.addMenuItem( 'savedocumentas', {
        text : 'Save as...',
        tooltip : 'Choose name and save file to browser storage',
        shortcut : 'meta+shift+S',
        onAction : () => showSaveAsDialog( editor )
    } )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        icon : 'save',
        tooltip : 'Save file to browser storage',
        shortcut : 'meta+S',
        onAction : () =>
            ( new LurchDocument( editor ).getFileID() ?
                silentFileSave : showSaveAsDialog )( editor )
    } )
    editor.ui.registry.addMenuItem( 'deletesaved', {
        text : 'Delete a saved document',
        tooltip : 'Delete a file currently stored in browser storage',
        onAction : () => showDeleteDialog( editor )
    } )
}

export default { install }
