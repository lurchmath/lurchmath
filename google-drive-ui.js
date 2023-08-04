
/**
 * This file creates simple TinyMCE dialog boxes and simple functions to access
 * them, to make it easy to provide file open, save, and save-as functionality
 * that can access the user's Google Drive.
 */

import {
    ensureLoggedIn, readFileFromDrive, writeNewFileToDrive,
    showOpenFilePicker, showSaveFolderPicker
} from './google-drive-utilities.js'

/**
 * Show a Google Drive file open dialog box, and if the user picks a file from
 * it, load that file into the given TinyMCE editor.  If an error occurs, pop up
 * a notification in the editor stating that an error occurred opening the file.
 * 
 * @param {tinymce.editor} editor the TinyMCE editor instance into which the
 *   file will be loaded, if the user chooses one
 */
const showFileOpenDialog = editor => ensureLoggedIn().then( () => {
    showOpenFilePicker().then( pickedFileId => {
        readFileFromDrive( pickedFileId ).then( response =>
            editor.setContent( response.body )
        ).catch( error => editor.notificationManager.open( {
            type : 'error',
            text : `Error opening file: ${error}`
        } ) )
    } )
} )

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
 */
const showSaveAsDialog = editor => ensureLoggedIn().then( () => {
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
                const content = editor.getContent()
                dialog.close()
                writeNewFileToDrive(
                    filename, folder.id, content
                ).then( () => editor.notificationManager.open( {
                    type : 'success',
                    text : 'File saved.',
                    timeout : 2000
                } ) )
                .catch( error => editor.notificationManager.open( {
                    type : 'error',
                    text : `Error saving file: ${error}`
                } ) )
            }
        } )
    } )
} )

// The following code is incorrect and needs to be rewritten to correctly
// distinguish Save from Save As.  This is a TO-DO.  I will document this code
// once it is fixed.
let lastUsedFilename = null
let lastUsedFolder = null
export const clearSaveLocation = () =>
    lastUsedFilename = lastUsedFolder = null
export const hasSaveLocation = () => lastUsedFilename !== null

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
 */
export const installDrive = editor => {
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
        onAction : () => hasSaveLocation() ?
            writeFileToDrive( lastUsedFilename, lastUsedFolder, editor.getContent() ) :
            showSaveAsDialog( editor )
    } )
}
