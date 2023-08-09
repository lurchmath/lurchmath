
/**
 * This file does the load and setup for the TinyMCE editor.  It ensures that
 * the editor fills the viewable area of the webpage.  It does this upon import,
 * by loading TinyMCE from its CDN into the page, adding an HTMLElement into
 * which to install TinyMCE, and then doing that installation.
 */

import { loadScript } from './utilities.js'
import { installSettings } from './settings-install.js'
import { installDrive } from './google-drive-ui.js'
import { installDownloader } from './downloader.js'

// TinyMCE's CDN URL, from which we will load it
const TinyMCEURL = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js'

// Add a textarea input element to the page, into which we will install TinyMCE
const textarea = document.createElement( 'textarea' )
textarea.setAttribute( 'id', 'editor' )
document.body.appendChild( textarea )

// Load TinyMCE from its CDN...
loadScript( TinyMCEURL ).then( () => {
    // ...then set up the editor in the textarea we created above
    tinymce.init( {
        selector : '#editor',
        promotion : false, // disable premium features advertisement
        toolbar : 'undo redo | '
                + 'styles bold italic | '
                + 'alignleft aligncenter alignright outdent indent | '
                + 'settings',
        menu: {
            file: {
                title: 'File',
                items: 'newlurchdocument opendocument savedocument savedocumentas | download | print' },
            edit: {
                title: 'Edit',
                items: 'undo redo | cut copy paste pastetext | selectall | searchreplace'
            },
            insert: {
                title: 'Insert',
                items: 'link emoticons hr | insertdatetime'
            },
            format: {
                title: 'Format',
                items: 'bold italic underline strikethrough superscript subscript | styles blocks fontfamily fontsize align lineheight | forecolor backcolor | language | removeformat'
            },
            help: { title: 'Help', items: 'help' }
        },
        plugins : 'fullscreen', // enable full screen mode
        statusbar : false,
        setup : editor => {
            // Activate full screen mode as soon as the editor is ready
            editor.on( 'init', () => editor.execCommand( 'mceFullScreen' ) )
            // Install settings-related UI
            installSettings( editor )
            // Install Google Drive-related UI
            installDrive( editor )
            // Install file downloader menu item
            installDownloader( editor )
        }
    } )
} )
