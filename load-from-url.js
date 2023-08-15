
/**
 * This file installs one tool into the user interface, a menu item for
 * importing a Lurch document from a given URL.  It also provides a function
 * that can be called on the URL when the page loads, to extract from its query
 * string a load command (if there is one) and obey it by loading the document
 * at the specified URL.  The query string should be of the form:
 * `http://xxx.yyy/page.html?load=URL_TO_LOAD`, where the `URL_TO_LOAD` is
 * appropriately URI-encoded.
 * 
 * @module ImportFromURL
 */

import { LurchDocument } from './lurch-document.js'

// Internal use only: Check to see if a string is a valid URL
const isValidURL = text => {
    try {
        new URL( text ) // will throw an error if the text is not a valid URL
        return true
    } catch ( e ) {
        return false
    }
}

// Internal use only: Fetch a file from an URL using a Promise
const getFromURL = url => new Promise( ( resolve, reject ) => {
    const request = new XMLHttpRequest()
    request.addEventListener( 'load', event =>
        resolve( event.currentTarget.responseText ) )
    request.addEventListener( 'error', reject )
    request.open( 'GET', url )
    request.send()
} )

/**
 * Install into a TinyMCE editor instance a new menu item: Import, intended for
 * the File menu.  It allows the user to specify a URL in a popup dialog, and
 * then it will attempt to import a document from the web using an
 * `XMLHttpRequest` at that URL.  This assumes that the TinyMCE initialization
 * code includes the "import" item on one of the menus.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const installImport = editor => {
    editor.ui.registry.addMenuItem( 'import', {
        text : 'Import from URL',
        tooltip : 'Import document from URL',
        onAction : () => {
            const dialog = editor.windowManager.open( {
                title : 'Import a document from a URL',
                body : {
                    type : 'panel',
                    items : [
                        {
                            name : 'url',
                            label : 'URL to import from:',
                            type : 'input',
                            placeholder : 'http://www.example.com/yourfile.html'
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
                    { text : 'Import', type : 'submit', enabled : false, name : 'importButton' },
                    { text : 'Cancel', type : 'cancel' }
                ],
                onChange : () => {
                    dialog.setEnabled( 'importButton',
                        isValidURL( dialog.getData()['url'] ) )
                },
                onSubmit : () => {
                    getFromURL( dialog.getData()['url'] )
                    .then( content =>
                        new LurchDocument( editor ).setDocument( content ) )
                    .catch( () => editor.notificationManager.open( {
                        type : 'error',
                        text : `Error importing document from ${url}.<br>
                            (Not all servers permit downloads from other domains.)`
                    } ) )
                    dialog.close()
                }
            } )
        }
    } )
}

/**
 * Check to see if the query string for the current page contains a "load=..."
 * parameter, and if so, treat its value as an URL and try to load a Lurch
 * document from that URL.  Place the document in the given editor on success,
 * and report an error with a notification on failure.
 * 
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which to
 *   load the document specified in the query string, if there is one
 * @function
 */
export const loadFromQueryString = editor => {
    const params = new URL( window.location ).searchParams
    if ( !params.has( 'load' ) ) return
    const url = params.get( 'load' )
    if ( !isValidURL( url ) )
        return editor.notificationManager.open( {
            type : 'error',
            text : 'Not a valid URL for importing: ' + url
        } )
    getFromURL( params.get( 'load' ) )
    .then( content => new LurchDocument( editor ).setDocument( content ) )
    .catch( () => editor.notificationManager.open( {
        type : 'error',
        text : `Error importing document from ${url}.<br>
            (Not all servers permit downloads from other domains.)`
    } ) )
}
