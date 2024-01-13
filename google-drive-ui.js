
/**
 * This file creates simple TinyMCE dialog boxes and simple functions to access
 * them, to make it easy to provide file open, save, and save-as functionality
 * that can access the user's Google Drive.
 * 
 * @module GoogleDriveUI
 */

import {
    readFileFromDrive, writeNewFileToDrive, updateFileInDrive,
    showOpenFilePicker, showSaveFolderPicker
} from './google-drive-utilities.js'
import { LurchDocument } from './lurch-document.js'
import { Dialog } from './dialog.js'

// Global variable for tracking the unique Google Drive ID of the last loaded
// file, so we can save back into its location if the user asks us to.
// This variable is updated when we open a file, and is reset to null when we
// execute File > New.
let lastUsedFileId = null

/**
 * Show a Google Drive file open dialog box, and if the user picks a file from
 * it, load that file into the given TinyMCE editor.  If an error occurs, pop up
 * a notification in the editor stating that an error occurred opening the file.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the
 *   file will be loaded, if the user chooses one
 * @function
 * @see {@link module:GoogleDriveUI.showSaveAsDialog showSaveAsDialog()}
 * @see {@link module:GoogleDriveUtilities.showOpenFilePicker showOpenFilePicker()}
 */
const showFileOpenDialog = editor => {
    showOpenFilePicker().then( pickedFileId => {
        lastUsedFileId = pickedFileId
        readFileFromDrive( pickedFileId ).then( response => {
            new LurchDocument( editor ).setDocument( response.body )
            Dialog.notify( editor, 'success', 'File opened.' )
        } ).catch( error =>
            Dialog.notify( editor, 'error', `Error opening file: ${error}` )
        )
    } )
}

/**
 * Show a Google Drive folder selection dialog box, and if the user selects a
 * folder, then show them a filename entry dialog box.  If they type a filename
 * and choose to save, the contents of the given editor are written into that
 * file as a new file in the given Google Drive folder.  Note that this always
 * creates a new file (because Google Drive folders can contain multiple files
 * with the same name).
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance whose content
 *   should be saved into the file the user chooses
 * @function
 * @see {@link module:GoogleDriveUI.showFileOpenDialog showFileOpenDialog()}
 * @see {@link module:GoogleDriveUI.silentFileSave silentFileSave()}
 * @see {@link module:GoogleDriveUtilities.showSaveFolderPicker showSaveFolderPicker()}
 */
const showSaveAsDialog = editor => {
    showSaveFolderPicker().then( folder => {
        const dialog = editor.windowManager.open( {
            title : 'Choose filename to save as',
            body : {
                type : 'panel',
                items : [
                    {
                        type : 'htmlpanel',
                        html : `<p>Saving into folder: ${folder.name}</p>`
                    },
                    {
                        type : 'input',
                        name : 'filename',
                        label : 'Filename',
                        placeholder : 'My Lurch document'
                    }
                ]
            },
            buttons : [
                { text : 'Save', type : 'submit' },
                { text : 'Cancel', type : 'cancel' }
            ],
            onSubmit : () => {
                const filename = dialog.getData()['filename']
                const content = new LurchDocument( editor ).getDocument()
                dialog.close()
                writeNewFileToDrive(
                    filename, folder.id, content
                ).then( () =>
                    Dialog.notify( editor, 'success', 'File saved.' )
                ).catch( error =>
                    Dialog.notify( editor, 'error', `Error saving file: ${error}` )
                )
            }
        } )
        setTimeout( () => dialog.focus( 'filename' ) )
    } )
}

/**
 * Silently (i.e., without asking the user anything in a dialog box) save the
 * given new content into the existing Google Drive file with the given ID.
 * If it succeeds, pop up a brief success notification.  If it fails, show a
 * failure notification containing the error and wait for the user to dismiss
 * it.
 * 
 * @param {tinymce.Editor} editor the editor to use for any notifications
 * @param {string} fileId the Google Drive file ID whose content should be
 *   updated
 * @function
 * @see {@link module:GoogleDriveUI.showSaveAsDialog showSaveAsDialog()}
 */
const silentFileSave = ( editor, fileId ) => {
    updateFileInDrive( fileId, new LurchDocument( editor ).getDocument() )
    .then( () =>
        Dialog.notify( editor, 'success', 'File saved.' )
    ).catch( error => 
        Dialog.notify( editor, 'error', `Error saving file: ${error}` )
    )
}

/**
 * Install into a TinyMCE editor instance three new menu items: Open, Save, and
 * Save as...  These three menu items will be associated with calls to the
 * appropriate dialog boxes and read/write utilities defined earlier in this
 * file.  A client can simply call this function on their editor instance, then
 * add the appropriate actions (named opendocument, savedocument, and
 * savedocumentas) to that editor's menus.
 * 
 * @param {tinymce.Editor} editor the editor instance into which the new actions
 *   should be installed
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'newlurchdocument', {
        text : 'New',
        icon : 'new-document',
        tooltip : 'New document',
        shortcut : 'meta+N',
        onAction : () => {
            lastUsedFileId = null
            new LurchDocument( editor ).newDocument()
        }
    } )
    editor.ui.registry.addMenuItem( 'opendocument', {
        text : 'Open',
        tooltip : 'Open file from Google Drive',
        shortcut : 'meta+O',
        onAction : () => showFileOpenDialog( editor )
    } )
    editor.ui.registry.addMenuItem( 'savedocumentas', {
        text : 'Save as...',
        tooltip : 'Choose name and save file to Google Drive',
        shortcut : 'meta+shift+S',
        onAction : () => showSaveAsDialog( editor )
    } )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        icon : 'save',
        tooltip : 'Save file to Google Drive',
        shortcut : 'meta+S',
        onAction : () => lastUsedFileId !== null ?
            silentFileSave( editor, lastUsedFileId ) :
            showSaveAsDialog( editor )
    } )
}

export default { install }
