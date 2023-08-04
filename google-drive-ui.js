
import {
    ensureLoggedIn, readFileFromDrive, writeFileToDrive,
    showOpenFilePicker, showSaveFolderPicker
} from './google-drive-utilities.js'

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
                writeFileToDrive(
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

let lastUsedFilename = null
let lastUsedFolder = null
export const clearSaveLocation = () =>
    lastUsedFilename = lastUsedFolder = null
export const hasSaveLocation = () => lastUsedFilename !== null

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
