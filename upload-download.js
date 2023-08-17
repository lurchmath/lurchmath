
/**
 * This file installs two tools into the user interface, one menu item for
 * downloading the current Lurch document to the user's computer and another for
 * uploading a new Lurch document into the editor.
 * 
 * @module DownloadUpload
 */

import { LurchDocument } from './lurch-document.js'

/**
 * Install into a TinyMCE editor instance two new menu items: Download and
 * Upload, both intended for the File menu.  The download menu item allows the
 * user to download the current Lurch document to their computer, assuming that
 * the TinyMCE initialization code includes the "download" item on one of the
 * menus.  The upload menu item pops up a dialog into which the user can drag a
 * file to upload it into the editor.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu items should be installed
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'download', {
        text : 'Download',
        icon : 'export',
        tooltip : 'Download document',
        onAction : () => {
            const content = new LurchDocument( editor ).getDocument()
            const anchor = document.createElement( 'a' )
            anchor.setAttribute( 'href', 'data:text/html;charset=utf-8,'
                + encodeURIComponent( content ) ) 
            anchor.setAttribute( 'download', 'lurch-document.html' )
            document.body.appendChild( anchor )
            anchor.click()
            anchor.remove()
        }
    } )
    editor.ui.registry.addMenuItem( 'upload', {
        text : 'Upload',
        icon : 'upload',
        tooltip : 'Upload document',
        onAction : () => {
            let uploadedContent = null
            const dialog = editor.windowManager.open( {
                title : 'Upload a file to edit',
                body : {
                    type : 'panel',
                    items : [
                        {
                            type : 'htmlpanel',
                            html : `<div id='fileUploadZone'>Drag a Lurch document here to open it.</div>`
                        },
                        {
                            type : 'alertbanner',
                            level : 'warn',
                            icon : 'warning',
                            text : 'This will overwrite the current contents of the editor.'
                        }
                    ]
                },
                buttons : [
                    { text : 'Open', type : 'submit', enabled : false, name : 'openButton' },
                    { text : 'Cancel', type : 'cancel' }
                ],
                onSubmit : () => {
                    // This can be done only if the user has actually dragged a
                    // file in; see the code below that enables the Open button.
                    // That same code stores the uploaded file in the
                    // uploadedContent variable, for us to access here.
                    new LurchDocument( editor ).setDocument( uploadedContent )
                    dialog.close()
                }
            } )
            // Style the zone appropriately
            const zone = document.getElementById( 'fileUploadZone' )
            zone.style.width = '100%'
            zone.style.height = '200px'
            zone.style.border = '1px dashed black'
            zone.style.display = 'flex'
            zone.style.justifyContent = 'center'
            zone.style.alignContent = 'center'
            zone.style.flexDirection = 'column'
            zone.style.textAlign = 'center'
            // Handle basic events for styling and preventing file opening
            zone.addEventListener( 'dragover', event => event.preventDefault() )
            zone.addEventListener( 'dragenter', _ =>
                zone.style.background = '#eeeeff' )
            zone.addEventListener( 'dragleave', _ =>
                zone.style.removeProperty( 'background' ) )
            // If the user drops a file, upload it into a local variable and
            // enable the Open button on the dialog footer.
            zone.addEventListener( 'drop', event => {
                event.preventDefault()
                const dropped = event.dataTransfer.items ?
                    Array.from( event.dataTransfer.items )
                        .filter( item => item.kind == 'file' ) :
                    Array.from( event.dataTransfer.files )
                if ( dropped.length > 0 ) {
                    const file = dropped[0].getAsFile()
                    file.text().then( content => {
                        uploadedContent = content
                        zone.innerHTML = 'File uploaded.<br>Confirm or cancel below.'
                        dialog.setEnabled( 'openButton', true )
                    } )
                }
            } )
        }
    } )
}

export default { install }
