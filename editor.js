
/**
 * This file does the load and setup for the TinyMCE editor.  It ensures that
 * the editor fills the viewable area of the webpage.  It does this upon import,
 * by loading TinyMCE from its CDN into the page, adding an HTMLElement into
 * which to install TinyMCE, and then doing that installation.
 */

import { loadScript } from './utilities.js'
import Settings from './settings-install.js'
// import GoogleDrive from './google-drive-ui.js'
import LocalStorageDrive from './local-storage-drive.js'
import Headers from './header-editor.js'
import DocSettings from './document-settings.js'
import Atoms from './atoms.js'
import Expressions from './expressions.js'
import Dependencies from './dependencies.js'
import MathPhrases from './math-phrases.js'
import Shells from './shells.js'
import Validation from './validation.js'
import { loadFromQueryString } from './load-from-url.js'
import AutoCompleter from './auto-completer.js'

// TinyMCE's CDN URL, from which we will load it
const TinyMCEURL = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js'

// Add a textarea input element to the page, into which we will install TinyMCE
const textarea = document.createElement( 'textarea' )
textarea.setAttribute( 'id', 'editor' )
const container = document.getElementById( 'editor-container' )
container.insertBefore( textarea , container.firstChild )

// Create the default JSON data for populating the editor's menus and toolbar:
const buildMenu = ( title, ...list ) => {
    return { title, items : list.join( ' | ' ) }
}
const menuData = {
    file : buildMenu( 'File',
        'newlurchdocument opendocument savedocument savedocumentas deletesaved',
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
        'insertdatetime',
        'expression',
        'environment paragraphabove paragraphbelow'
    ),
    format : buildMenu( 'Format',
        'bold italic underline strikethrough superscript subscript',
        'styles blocks fontfamily fontsize align lineheight',
        'forecolor backcolor',
        'language',
        'removeformat'
    ),
    document : buildMenu( 'Document',
        'editheader extractheader embedheader',
        'dependency mathphrasedef',
        'clearvalidation validate',
        'docsettings'
    ),
    help : buildMenu( 'Help', 'help' )
}
let toolbarData = 'undo redo | '
                + 'styles bold italic | '
                + 'alignleft aligncenter alignright outdent indent'

// If this instance of the app is just a popup for editing the header in the
// document of a different instance of the app, we will need to delete
// irrelevant menu items before they get installed/displayed:
if ( Headers.isEditor() ) {
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
        content_css : ['document','lurch.css'],
        visual_table_class : 'lurch-borderless-table',
        height : "100%",
        promotion : false, // disable premium features advertisement
        toolbar : toolbarData,
        menubar : 'file edit insert format document help',
        menu : menuData,
        // plugins : 'fullscreen', // enable full screen mode
        statusbar : false,
        setup : editor => {
            // As soon as the editor is ready, ensure it's not in front
            // of any future Google Drive dialogs
            editor.on( 'init', () => {
                // editor.execCommand( 'mceFullScreen' )
                document.querySelector( '.tox-tinymce' ).style.zIndex = 500
            } )
            // Install all tools the editor always needs:
            Settings.install( editor )
            Atoms.install( editor )
            Expressions.install( editor )
            Shells.install( editor )
            Dependencies.install( editor )
            MathPhrases.install( editor )
            Validation.install( editor )
            AutoCompleter.install( editor )
            if ( !Headers.isEditor() ) {
                // Install tools we need only if we are the primary app window:
                // GoogleDrive.install( editor )
                LocalStorageDrive.install( editor )
                Headers.install( editor )
                DocSettings.install( editor )
                editor.on( 'init', () => loadFromQueryString( editor ) )
            } else {
                // Install tools we need only if we are the secondary app window:
                Headers.listen( editor )
            }
            // Create keyboard shortcuts for all menu items
            const menuItems = editor.ui.registry.getAll().menuItems
            for ( let itemName in menuItems ) {
                const item = menuItems[itemName]
                if ( item.hasOwnProperty( 'shortcut' ) ) {
                    const shortcut = item.shortcut
                        .replace( /enter/i, '13' )
                        .replace( /space/i, '32' )
                    editor.addShortcut( shortcut, item.text,
                        () => item.onAction() )
                }
            }
        }
    } )
} )
