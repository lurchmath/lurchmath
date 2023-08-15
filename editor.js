
/**
 * This file does the load and setup for the TinyMCE editor.  It ensures that
 * the editor fills the viewable area of the webpage.  It does this upon import,
 * by loading TinyMCE from its CDN into the page, adding an HTMLElement into
 * which to install TinyMCE, and then doing that installation.
 */

import { loadScript } from './utilities.js'
import { installSettings } from './settings-install.js'
import { installDrive } from './google-drive-ui.js'
import { installDownloadUpload } from './upload-download.js'
import { installImport, loadFromQueryString } from './load-from-url.js'
import { installHeaderEditor, isHeaderEditor, listenForHeader } from './header-editor.js'
import { installDocumentSettings } from './document-settings.js'

// TinyMCE's CDN URL, from which we will load it
const TinyMCEURL = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js'

// Add a textarea input element to the page, into which we will install TinyMCE
const textarea = document.createElement( 'textarea' )
textarea.setAttribute( 'id', 'editor' )
document.body.appendChild( textarea )

// Create the default JSON data for populating the editor's menus and toolbar:
const buildMenu = ( title, ...list ) => {
    return { title, items : list.join( ' | ' ) }
}
const menuData = {
    file : buildMenu( 'File',
        'newlurchdocument opendocument savedocument savedocumentas',
        'upload download import',
        'print'
    ),
    edit : buildMenu( 'Edit',
        'undo redo',
        'cut copy paste pastetext',
        'selectall',
        'searchreplace',
        'preferences'
    ),
    insert : buildMenu( 'Insert',
        'link emoticons hr',
        'insertdatetime'
    ),
    format : buildMenu( 'Format',
        'bold italic underline strikethrough superscript subscript',
        'styles blocks fontfamily fontsize align lineheight',
        'forecolor backcolor',
        'language',
        'removeformat'
    ),
    document : buildMenu( 'Document',
        'editheader docsettings'
    ),
    help : buildMenu( 'Help', 'help' )
}
let toolbarData = 'undo redo | '
                + 'styles bold italic | '
                + 'alignleft aligncenter alignright outdent indent'

// If this instance of the app is just a popup for editing the header in the
// document of a different instance of the app, we will need to delete
// irrelevant menu items before they get installed/displayed:
if ( isHeaderEditor() ) {
    ;[
        'newlurchdocument', 'opendocument', 'savedocumentas', 'editheader'
    ].forEach( toRemove => {
        Object.keys( menuData ).forEach( menu =>
            menuData[menu].items = menuData[menu].items
                .replace( toRemove+' ', '' ).replace( ' '+toRemove, '' ) )
    } )
}

// Load TinyMCE from its CDN...
loadScript( TinyMCEURL ).then( () => {
    // ...then set up the editor in the textarea we created above
    tinymce.init( {
        selector : '#editor',
        promotion : false, // disable premium features advertisement
        toolbar : toolbarData,
        menubar : 'file edit insert format document help',
        menu : menuData,
        plugins : 'fullscreen', // enable full screen mode
        statusbar : false,
        setup : editor => {
            // Activate full screen mode as soon as the editor is ready
            editor.on( 'init', () => editor.execCommand( 'mceFullScreen' ) )
            // Install settings-related UI
            installSettings( editor )
            // Install file downloader and uploader menu items
            installDownloadUpload( editor )
            // Install URL importer menu item
            installImport( editor )
            // Certain tools should be installed only on the main editor:
            if ( !isHeaderEditor() ) {
                // Install Google Drive-related UI
                installDrive( editor )
                // Install the menu item for editing the document's header
                installHeaderEditor( editor )
                // Install the menu item for editing the document's settings
                installDocumentSettings( editor )
                // After the editor is loaded, import a doc from the query string, if any:
                editor.on( 'init', () => loadFromQueryString( editor ) )
            } else {
                // But the header editor needs to listen for a setup message
                // that we will send it right after it loads:
                listenForHeader( editor )
            }
        }
    } )
} )
