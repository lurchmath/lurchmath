
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
import { appURL } from './utilities.js'

// Internal use only: Check to see if a string is a valid URL
const isValidURL = text => {
    try {
        new URL( text ) // will throw an error if the text is not a valid URL
        return true
    } catch ( e ) {
        return false
    }
}

/**
 * Download a file from the web asynchronously, returning a Promise that
 * resolves when the download completes (passing the content of the file as a
 * string) or rejects if the download fails.  Note that many servers have
 * cross-origin restrictions that will prevent this, but servers whose purpose
 * is to share files publicly (e.g., GitHub) do not have this problem.  So this
 * may fail not only because the URL is invalid or the network is unreachable,
 * but also because the server may reject the request.
 * 
 * @param {string} url - URL from which to load data
 * @returns {Promise} a Promise that resolves if the file downloaded correctly
 *   and rejects if an error occurred or a response with status other than 200
 *   was returned
 * @see {@link module:ImportFromURL.loadFromQueryString loadFromQueryString()}
 */
export const loadFromURL = url => new Promise( ( resolve, reject ) => {
    const request = new XMLHttpRequest()
    request.addEventListener( 'load', event => {
        if ( event.target.status != 200 )
            reject( event.currentTarget.responseText )
        else
            resolve( event.currentTarget.responseText )
    } )
    request.addEventListener( 'error', reject )
    request.open( 'GET', url )
    request.send()
} )

/**
 * Check to see if the query string for the current page contains a "load=..."
 * parameter, and if so, treat its value as an URL and try to load a Lurch
 * document from that URL.  Place the document in the given editor on success,
 * and report an error with a notification on failure.
 * 
 * @param {tinymce.Editor} editor - the TinyMCE editor instance into which to
 *   load the document specified in the query string, if there is one
 * @function
 * @see {@link module:ImportFromURL.loadFromURL loadFromURL()}
 * @see {@link module:ImportFromURL.autoOpenLink autoOpenLink()}
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
    loadFromURL( params.get( 'load' ) )
    .then( content => new LurchDocument( editor ).setDocument( content ) )
    .catch( () => editor.notificationManager.open( {
        type : 'error',
        text : `Error importing document from ${url}.<br>
            (Not all servers permit downloads from other domains.)`
    } ) )
}

/**
 * Create a URL that will load the Lurch app and then import a document from a
 * given URL immediately.
 * 
 * @param {string} url - the URL referring to the document that should be opened
 * @returns {string} a URL that points to this Lurch app, but with the given
 *   `url` embedded in the query string, as an instruction to open it
 * @function
 * @see {@link module:ImportFromURL.loadFromQueryString loadFromQueryString()}
 * @see {@link module:Utilities.appURL appURL()}
 */
export const autoOpenLink = url =>
    appURL() + '?load=' + encodeURIComponent( url )

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
export const install = editor => {
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
                    loadFromURL( dialog.getData()['url'] )
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
            setTimeout( () => dialog.focus( 'url' ), 0 )
        }
    } )
}

export default { loadFromQueryString, loadFromURL, install }
