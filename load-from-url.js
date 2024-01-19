
/**
 * This file defines several tools for loading Lurch documents from URLs on the
 * web, specified in a dialog box or specified in the query string of the app on
 * launch.
 * 
 * @module ImportFromURL
 */

import { LurchDocument } from './lurch-document.js'
import { appURL, isValidURL } from './utilities.js'
import { Dialog } from './dialog.js'
import {
    fileExists, readFile, writeFile, deleteFile
} from './local-storage-drive.js'

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
    request.setRequestHeader( 'Cache-Control', 'max-age=0' )
    request.send()
} )

/**
 * Check to see if the query string for the current page contains a "load=..."
 * parameter, and if so, treat its value as either an URL (and try to load a
 * Lurch document from that URL) or a filename in the browser's local storage
 * (and try to load a Lurch document from there).  Place the document in the
 * given editor on success, and report an error with a notification on failure.
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
    const source = params.get( 'load' )
    if ( fileExists( source ) ) {
        new LurchDocument( editor ).setDocument( readFile( source ) )
        if ( params.has( 'delete' ) && params.get( 'delete' ) == 'true' )
            deleteFile( source )
        // window.history.replaceState( null, null, appURL() )
    } else if ( isValidURL( source ) ) {
        loadFromURL( source )
        .then( content => new LurchDocument( editor ).setDocument( content ) )
        .catch( () => Dialog.notify( editor, 'error',
            `Error importing document from ${source}.<br>
            (Not all servers permit downloads from other domains.)` ) )
        // window.history.replaceState( null, null, appURL() )
    } else {
        Dialog.notify( editor, 'error', 'Not a valid file source: ' + source )
    }
}

/**
 * Open a new browser tab, and in that tab load another copy of the Lurch
 * application, and have that copy load into its editor the document whose
 * content is given as argument.  This is done by saving that content to a
 * temporary file in the browser's local storage, and using the query string of
 * the new tab to direct it to that temporary file, which that new tab will also
 * delete once it has read it.
 * 
 * @param {string} content - the contents of a document to display in a new
 *   window
 */
export const openFileInNewWindow = content => {
    let i = 0
    while ( fileExists( `temp_file_${i}` ) ) i++
    writeFile( `temp_file_${i}`, content )
    window.open( autoOpenLink( `temp_file_${i}`, true ), '_blank' )
}

/**
 * Create a URL that will load the Lurch app and then import a document from a
 * given source immediately.
 * 
 * @param {string} source - the URL or local filename referring to the document
 *   that should be opened ("local filename" means in the browser's local storage)
 * @param {boolean} [andDelete=false] - whether to delete the file after opening
 *   it (which makes sense only for local files, not URLs)
 * @returns {string} a URL that points to this Lurch app, but with the given
 *   source embedded in the query string, as an instruction to open it
 * @function
 * @see {@link module:ImportFromURL.loadFromQueryString loadFromQueryString()}
 * @see {@link module:Utilities.appURL appURL()}
 */
export const autoOpenLink = ( source, andDelete = false ) =>
    appURL() + '?load=' + encodeURIComponent( source )
             + ( andDelete ? '&delete=true' : '' )

/**
 * An item that can be used in a {@link Dialog} to let the user import a file
 * from an URL on the web.  This is a simple text input control, but it shows a
 * URL as its placeholder and labels itself appropriately.
 */
export class ImportFromURLItem {

    /**
     * Construct a new URL import input control.
     * 
     * @param {string} name - the key to use to identify this input control's
     *   content in the dialog's key-value mapping for all input controls
     */
    constructor ( name ) {
        this.name = name
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            name : this.name,
            label : 'URL to import from:',
            type : 'input',
            placeholder : 'http://www.example.com/yourfile.html'
        } ]
    }

}

export default { loadFromQueryString, loadFromURL }
