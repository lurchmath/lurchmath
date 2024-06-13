
import { FileSystem } from './file-system.js'
import { makeAbsoluteURL, loadScript } from './utilities.js'

// Internal use only, Lurch app key for Dropbox
const APP_KEY = '7mfyk58haigi2c4'
// Internal use only, how long before the login popup times out and rejects
const LOGIN_TIMEOUT = 30000 // in ms
// Internal use only, URL to CDN with the Dropbox JavaScript SDK
const SDK_URL = 'https://unpkg.com/dropbox@10/dist/Dropbox-sdk.min.js'

// Dropbox API calls return file/folder metadata with this format:
// if entry['.tag'] == 'file', entry has:
//   name, id, size, path_lower, is_downloadable, and more
// if entry['.tag'] == 'folder', entry has:
//   same, but not is_downloadable
// if entry['.tag'] == 'deleted', entry has:
//   same, but not id
// if response.result.has_more, then call:
//   client.filesListFolderContinue( {
//     cursor : response.result.cursor } )

/**
 * An instance of the Dropbox SDK's "Dropbox" object, which contains all the
 * methods for communicating with the Dropbox servers.  Documentation for how
 * this object works is available online from the Dropbox developer site, at
 * {@link https://www.dropbox.com/developers/documentation?_tk=pilot_lp&_ad=topbar1&_camp=docs
 * this link}.
 * 
 * This module exports this object so that any other portion of the app code can
 * get access to dropbox by just importing this one constant from this module.
 */
export const getClient = () => loadScript( SDK_URL ).then( () =>
    new Dropbox.Dropbox( { clientId : APP_KEY } ) )

// Internal use only; combine two paths like Python's path.join()
const makeAbsolutePath = ( path1, path2 ) => {
    // If path1 is empty or path2 is absolute, then just use path2.
    if ( /^\s*$/.test( path1 ) || path2.startsWith( '/' ) )
        return path2
    // Since path2 is relative, so we need to add it to the end of path1.
    // Easiest case: When path1 ends with a /.
    if ( path1.endsWith( '/' ) )
        return path1 + path2
    // Next easiest case: If path1 ends with "foo.bar" we assume that's a file
    // because of the extension, so we replace that with path2.
    const parts = path1.split( '/' )
    if ( parts[parts.length-1].includes( '.' ) ) {
        parts[parts.length-1] = path2
        return parts.join( '/' )
    }
    // Tricky case: path1 ends in what doesn't seem to be a file (no extension)
    // so we will guess that it is probably the path to a folder, and will thus
    // just glue path2 on with a slash in between.
    return path1 + '/' + path2
}

// Internal use only
// Launch a popup window in which the Dropbox authentication UI is displayed,
// and resolve/reject a promise when that process completes (or times out).
const doLoginProcess = () => new Promise( ( resolve, reject ) => {
    // The only way this rejects is through a timeout.
    const rejectionTimeout = setTimeout( () => reject( 'Timed out' ), LOGIN_TIMEOUT )
    // Ask Dropbox for an authentication URL that redirects back to the Dropbox
    // login page in this folder:
    getClient().then( client =>
        client.auth.getAuthenticationUrl(
            makeAbsoluteURL( 'dropbox-login.html' ),
            undefined,             // optional state to help defeat XSS attacks
            'code',                // auth type is PKCE (see below for details)
            'offline',             // this means we get a refresh token, too
            undefined,             // use scope settings from our app's Dropbox portal
            undefined,             // don't make any modifications to those settings
            true                   // the PKCE type should be Sha256
        )
        // Now use that URL to open a popup window that asks the user to log in to
        // their Dropbox, and redirect to our callback page when they do so.
        .then( authUrl => {
            // We are using PKCE (proof key for code exchange), because Dropbox docs
            // say that it is a secure method for apps like ours.  It uses a code
            // verifier, which we must store on the client for later verification of
            // the user's login info:
            window.sessionStorage.clear()
            window.sessionStorage.setItem( 'code_verifier', client.auth.codeVerifier )
            // Now open the popup for login:
            window.open( authUrl, 'DropboxAuth', 'width=600,height=600' )
            // When the user finishes logging in, Dropbox will redirect to our
            // dropbox-login.html callback page, which will send a message to THIS
            // page containing the access and refresh tokens.
            window.addEventListener( 'message', event => {
                // Only listen to messages from pages on this same server.
                if ( event.origin !== window.location.origin ) return
                // The key pieces of login info are access and refresh tokens.
                // We tell the Dropbox client about the access token, and we store
                // the refresh token so we can update the access token later:
                client.auth.setAccessToken( event.data.access_token )
                window.localStorage.setItem(
                    'refresh_token', event.data.refresh_token )
                // Say that we have succeeded, and prevent a failure from timeout:
                clearTimeout( rejectionTimeout )
                resolve( client )
            } )
        } ).catch( reject )
    ).catch( reject )
} )

// Internal use only
// Ensure that we have access to the user's Dropbox, either by asking them to
// log in, or by finding in the browser's local storage a refresh token that is
// still valid, so that the user doesn't have to log in again.
const ensureAccess = () => new Promise( ( resolve, reject ) => {
    // If we don't have a refresh token stored, then the user has not yet
    // logged in to Dropbox on this browser, so make them do that.
    const refreshToken = window.localStorage.getItem( 'refresh_token' )
    if ( !refreshToken )
        return doLoginProcess().then( resolve ).catch( reject )
    // We do have a refresh token, so try to use it to get refresh the access to
    // the user's Dropbox.  Only ask for a re-login if that attempt fails.
    getClient().then( client => {
        client.auth.setRefreshToken( refreshToken )
        client.auth.refreshAccessToken().then(
            () => resolve( client )
        ).catch( error => {
            console.log( 'User must log in again because there was an error '
                + 'refreshing the access token: ' + error )
            doLoginProcess().then( resolve ).catch( reject )
        } )
    } ).catch( reject )
} )

/**
 * A subclass of {@link FileSystem} that reads from/writes to the user's
 * Dropbox, but of course only if the user logs in and gives the app access to
 * do so.  It implements all the abstract methods of the parent class, but
 * specific to that one storage location.  The permissions set in the Dropbox
 * developer portal for the Lurch app are that it will use only the
 * `/Apps/Lurch/` subfolder of the user's Dropbox.  It is a Dropbox convention
 * that apps that don't need full access to the user's Dropbox use a subfolder
 * of the `/Apps/` folder, based on the name of the app in question, such as
 * `/Apps/Lurch/`.
 * 
 * Dropbox uses filenames and paths, but it also supports file IDs.  This first
 * implementation uses only filenames and paths, but support could be added
 * later for file IDs if needed.
 */
export class DropboxFileSystem extends FileSystem {

    static subclassName = FileSystem.registerSubclass(
        'Dropbox', DropboxFileSystem )

    /**
     * See the documentation of the {@link FileSystem#read read()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a file system based on
     * the user's Dropbox, as defined at {@link DropboxFileSystem
     * the documentation for this class}.
     * 
     * Any file object that does not have a `.filename` member (including the
     * case where the parameter is omitted) will be interpreted as a folder (and
     * if the `.path` member is omitted, it counts as the root).
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#read the abstract
     *   method of the parent class}
     */
    read ( fileObject ) {
        // error cases
        if ( !fileObject?.filename )
            return Promise.reject( new Error( 'Missing filename' ) )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        // correct case
        return new Promise( ( resolve, reject ) => {
            const absolute = makeAbsolutePath(
                fileObject.path || '', fileObject.filename )
            ensureAccess().then( client => {
                client.filesDownload( { path : absolute } ).then( response => {
                    response.result.fileBlob.text().then( result => {
                        fileObject.contents = result
                        fileObject.fileSystemName = this.getName()
                        resolve( fileObject )
                    } ).catch( reject )
                } ).catch( reject )
            } ).catch( reject )
        } )
    }

    /**
     * See the documentation of the {@link FileSystem#write write()} method in
     * the parent class for the definition of how this method must behave.  This
     * implements the requirements specified there for a file system
     * representing the user's Dropbox, as defined at {@link DropboxFileSystem
     * the documentation for this class}.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#write the abstract
     *   method of the parent class}
     */
    write ( fileObject ) {
        // Case 1: Invalid input of various types
        if ( !fileObject )
            throw new Error( 'File object required for saving' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( !fileObject.hasOwnProperty( 'filename' ) )
            throw new Error( 'No filename provided' )
        if ( !fileObject.hasOwnProperty( 'contents' ) )
            throw new Error( 'No content to write' )
        // Case 2: Filename and contents provided, can save
        const absolute = makeAbsolutePath(
            fileObject.path || '/', fileObject.filename )
        return new Promise( ( resolve, reject ) => {
            ensureAccess().then( client => {
                const toUpload = {
                    path : absolute,
                    mode : 'overwrite',
                    contents : fileObject.contents
                }
                client.filesUpload( toUpload ).then( () => {
                    fileObject.fileSystemName = this.getName()
                    this.documentSaved( fileObject )
                    resolve( fileObject )
                } ).catch( reject )
            } )
        } )
    }

    /**
     * See the documentation of the {@link FileSystem#delete delete()} method in
     * the parent class for the definition of how this method must behave.  This
     * implements the requirements specified there for a file system representing
     * the user's Dropbox, as defined at {@link DropboxFileSystem the
     * documentation for this class}.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#delete the abstract
     *   method of the parent class}
     */
    delete ( fileObject ) {
        // Case 1: Invalid input of various types
        if ( !fileObject?.filename )
            throw new Error( 'No filename provided' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        // Case 2: Name of file provided, try to delete it
        const absolute = makeAbsolutePath(
            fileObject.path || '', fileObject.filename )
        return new Promise( ( resolve, reject ) => {
            ensureAccess().then( client => {
                client.filesDelete( { path : absolute } ).then( () => {
                    resolve( fileObject )
                } ).catch( reject )
            } ).catch( reject )
        } )
    }

    /**
     * See the documentation of the {@link FileSystem#has has()} method in the
     * parent class for the definition of how this method must behave.  This
     * implements the requirements specified there for a file system representing
     * the user's Dropbox, as defined at {@link DropboxFileSystem the
     * documentation for this class}.
     * 
     * Because this is a flat file system, any file object with a nonempty path
     * member will not exist, regardless of its filename, and will therefore
     * result in a false value being resolved from the promise.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#has the abstract
     *   method of the parent class}
     */
    has ( fileObject ) {
        // If the parameter is missing or for the wrong file system, stop there
        if ( !fileObject )
            throw new Error( 'Missing required file object argument' )
        if ( fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        // Check to see if the file is present by asking for its metadata
        const absolute = makeAbsolutePath(
            fileObject.path || '/', fileObject.filename )
        return new Promise( ( resolve, reject ) => {
            ensureAccess().then( client => {
                console.log( absolute )
                try {
                    client.filesGetMetadata( { path : absolute } ).then( () => {
                        resolve( true )
                    } ).catch( () => {
                        resolve( false )
                    } )
                } catch ( e ) {
                    console.log( e )
                    resolve( false )
                }
            } ).catch( reject )
        } )
    }

    /**
     * See the documentation of the {@link FileSystem#list list()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a file system based on
     * the user's Dropbox, as defined at {@link DropboxFileSystem the
     * documentation for this class}.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#list the abstract
     *   method of the parent class}
     */
    list ( fileObject ) {
        // If wrong filesystem, stop there
        if ( fileObject?.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        // Otherwise, just use the fileObject's path, or default to '' if empty:
        const pathToList = fileObject?.path || ''
        return new Promise( ( resolve, reject ) => {
            ensureAccess().then( client => {
                // We will connect all the results here, over possibly >1 page
                // of responses from Dropbox
                const allResults = [ ]
                const addResults = results => allResults.push( ...results )
                // When all pages have been collected, we will call this to
                // resolve the promise with all their results:
                const finish = () => resolve( allResults.map( entry => {
                    if ( entry['.tag'] == 'file' ) {
                        const path = entry.path_lower.split( '/' )
                        path.pop()
                        return {
                            fileSystemName : this.getName(),
                            filename : entry.name,
                            UID : entry.id,
                            path : path.join( '/' ) + '/'
                        }
                    }
                    if ( entry['.tag'] == 'folder' ) return {
                        fileSystemName : this.getName(),
                        path : entry.path_lower
                    }
                    throw new Error( 'Unknown file object tag: ' + entry['.tag'] )
                } ) )
                // When one page of results comes in, we will call this to
                // decide whether we are done or not, and either ask for more
                // results or, if we've hit the last page, finish the process:
                const processResponse = response => {
                    addResults( response.result.entries )
                    if ( response.result.has_more ) {
                        client.filesListFolderContinue( {
                            cursor : response.result.cursor
                        } ).then( processResponse ).catch( reject )
                    } else {
                        finish()
                    }
                }
                // Use all the tools above to make the request to Dropbox:
                const request = {
                    path : pathToList,
                    recursive : false,
                    include_deleted : false
                }
                client.filesListFolder( request )
                .then( processResponse ).catch( reject )
            } ).catch( reject )
        } )
    }

}
