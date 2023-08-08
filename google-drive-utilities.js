
/**
 * Functions for communicating with the Google Drive API.  This file abstracts
 * just the few key ways that Lurch wants to talk to a user's Google Drive, plus
 * the few Google-owned popup windows that may need to be presented, and exposes
 * them in a small API that makes it easier than making raw gapi calls.
 * 
 * The app will not import this module directly, but will instead import the
 * {@link module:GoogleDriveUI Google Drive UI module}, which uses this one
 * under the hood.
 * 
 * @module GoogleDriveUtilities
 */

import { loadScript } from './utilities.js'

// Bring several constants to the top for better organization
const GoogleDriveAPI = 'https://apis.google.com/js/api.js'
const GoogleSignInAPI = 'https://apis.google.com/js/platform.js'
const discoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const fileScope = 'https://www.googleapis.com/auth/drive.file'
const uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const googleFolderMIMEType = 'application/vnd.google-apps.folder'
const lurchMimeType = 'text/html'

// Ensure that we have loaded
//   (a) our API and Client keys,
//   (b) the Google sign-in API, and
//   (c) the Google Drive API.
// Note that we load one API key if we are developing on localhost (a secret key
// we do not share with anyone or publish in our repo, because it could be
// misused by anyone who launches our app on their own machine) but we load a
// different API key if we are deploying the app on lurchmath.github.io (a public
// key we can share with anyone, because it will not function except on that one
// domain, which we control).
loadScript( window.location.hostname == 'localhost' ?
            '/google-api-key-secret.js' :
            '/google-api-key-public.js' ).then( () => {
loadScript( GoogleSignInAPI ).then( () => {
loadScript( GoogleDriveAPI ).then( () => {
    gapi.load( 'client:auth2', () => {
        gapi.client.init( {
            apiKey : window.LurchAPIKey,
            clientId : window.LurchClientId,
            discoveryDocs : [ discoveryDoc ],
            scope : fileScope
        } ) // Drive API will be ready when this promise resolves.
    } )
} ) } ) } )

/**
 * Just a shortcut to simplify multiple pieces of code later that need to get
 * the current user from a chain of Google API calls.
 * 
 * @function
 */
const currentUser = () => gapi.auth2.getAuthInstance().currentUser.get()

/**
 * Ensure the user has logged in by looking up their existing login information
 * if they've already logged in, or forcing them to log in so that we can get
 * their information thereafter.
 * 
 * @returns {Promise} a promise that resolves with the user as parameter upon
 *   success, or rejects if the user does not/cannot log in
 * @function
 */
export const ensureLoggedIn = () => new Promise( ( resolve, reject ) => {
    const authInstance = gapi.auth2.getAuthInstance()
    const authorizeUser = () => {
        const idToken = currentUser().getAuthResponse().id_token
        currentUser().reloadAuthResponse().then( () => {
            currentUser().getAuthResponse().id_token = idToken
            resolve( currentUser() )
        } ).catch( reject )
    }
    if ( authInstance.isSignedIn.get() ) {
        authorizeUser()
    } else {
        authInstance.signIn().then( authorizeUser )
    }
} )

/**
 * Read a file from the current user's Google Drive.  The client must pass a
 * file ID, which can be obtained by allowing the user to select a file from
 * their drive, using a function such as
 * {@link module:GoogleDriveUtilities.showOpenFilePicker showOpenFilePicker()}.
 * 
 * @param {string} fileId a file ID from Google Drive
 * @returns {Promise} a promise that resolves if the file can be read, passing a
 *   response object whose `body` field contains the file's contents, or that
 *   rejects if the file cannot be read
 * @function
 */
export const readFileFromDrive = fileId => gapi.client.drive.files.get( {
    fileId : fileId,
    alt : 'media'
} )

/**
 * Write a new file to the current user's Google Drive.  The client must pass a
 * filename and folder ID, along with the content they want in the file.  Note
 * that in Google Drive, unlike many filesystems, you can have multiple files
 * with the same name in the same folder, so this function always creates a new
 * file.  To get a folder ID, use a function such as
 * {@link module:GoogleDriveUtilities.showSaveFolderPicker showSaveFolderPicker()}
 * 
 * If you want to update/overwrite an existing file, use
 * {@link module:GoogleDriveUtilities.updateFileInDrive updateFileInDrive()}
 * instead.
 * 
 * This function always creates files with MIME type text/html, because that is
 * the MIME type we are currently using for files created by the Lurch app.
 * 
 * @param {string} filename the name of the new file to create
 * @param {string} folderId a folder ID from Google Drive
 * @param {string} content the data to write into the new file
 * @returns {Promise} a promise that resolves once the file is created, or
 *   rejects with an error message if the write attempt fails
 * @function
 */
export const writeNewFileToDrive = ( filename, folderId, content ) => {
    const metadata = {
        name : filename,
        mimeType : lurchMimeType,
        parents : [ folderId ]
    }
    const formData = new FormData()
    formData.append( 'metadata', new Blob(
        [ JSON.stringify( metadata ) ],
        { type : 'application/json' }
    ) )
    formData.append( 'file', new Blob( [ content ], { type : lurchMimeType } ) )
    return fetch( uploadEndpoint, {
        method : 'POST',
        headers : new Headers( {
            'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        } ),
        body : formData
    } )
}

/**
 * Update an existing file in the user's Google Drive by replacing its old
 * content with new content.  The client must pass a file ID plus the new
 * content to put into the file.  To get a file ID, use a function such as
 * {@link module:GoogleDriveUtilities.showOpenFilePicker showOpenFilePicker()}.
 * 
 * If you want to create a new file, use
 * {@link module:GoogleDriveUtilities.writeNewFileToDrive writeNewFileToDrive()}
 * instead.
 * 
 * This function always creates files with MIME type text/html, because that is
 * the MIME type we are currently using for files created by the Lurch app.
 * 
 * @param {string} filename the name of the new file to create
 * @param {string} folderId a folder ID from Google Drive
 * @param {string} content the data to write into the new file
 * @returns {Promise} a promise that resolves once the file is created, or
 *   rejects with an error message if the write attempt fails
 * @function
 */
export const updateFileInDrive = ( fileId, newContent ) => {
    const URL = uploadEndpoint.replace( 'files?', `files/${fileId}?` )
    return fetch( URL, {   
        method : 'PATCH',
        headers : new Headers( {
            'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        } ),
        body: new Blob( [ newContent ], { type : lurchMimeType } )
    } )
}

/**
 * This function retrieves a list of all files in a given Google Drive folder
 * that are of the MIME type used by this app (text/html).  The files may be
 * fetched in multiple pages, but this function fetches all necessary pages and
 * passes the concatenated files list to its promise resolution function.
 * 
 * @param {string} folderId the folder whose contents should be listed
 * @returns {Promise} a promise that resolves when the full list of files has
 *   been fetched, passing the array of filenames to the resolve function, or
 *   rejects if an error occurs during the reading process
 * @function
 */
export const listFilesFromFolder = ( folderId = 'root' ) => new Promise( ( resolve, reject ) => {
    const parameters = {
        pageSize : 10,
        fields : 'nextPageToken, files(id, name)',
        q : `'${folderId}' in parents and mimeType = '${lurchMimeType}'`
    }
    const result = [ ]
    const collect = response => {
        response.result.files.forEach( file => result.push( file ) )
        if ( !response.nextPageToken ) return resolve( result )
        parameters.pageToken = response.nextPageToken
        gapi.client.drive.files.list( parameters ).then( collect ).catch( reject )
    }
    gapi.client.drive.files.list( parameters ).then( collect ).catch( reject )
} )

/**
 * Show the user a file picker designed by Google, showing all text/html files
 * in their Google Drive.  The user may navigate among folders to choose files.
 * If they select one, the resulting promise resolves with that file's ID.
 * 
 * @returns {Promise} a promise that resolves with the selected file ID if the
 *   user chooses one, or never resolves if they cancel
 * @function
 */
export const showOpenFilePicker = () => new Promise( ( resolve, _ ) => {
    gapi.load( 'picker', () => {
        const view = new google.picker.DocsView()
        view.setMode( google.picker.DocsViewMode.LIST )
        view.setIncludeFolders( true )
        view.setMimeTypes( lurchMimeType )
        const picker = new google.picker.PickerBuilder()
            .setTitle( 'Choose a file to open' )
            .setDeveloperKey( window.LurchAPIKey )
            .setAppId( window.LurchClientId )
            .setOAuthToken( currentUser().getAuthResponse().access_token )
            .addView( view )
            .setCallback( event => {
                if ( event[google.picker.Response.ACTION] === google.picker.Action.PICKED ) {
                    const file = event[google.picker.Response.DOCUMENTS][0]
                    const fileId = file[google.picker.Document.ID]
                    resolve( fileId )
                }
            } )
            .build()
        picker.setVisible( true )
        picker.V.style.zIndex += 5000 // hack to put it in front of TinyMCE
    } )
} )

/**
 * Show the user a folder picker designed by Google, allowing the user to pick
 * a folder (other than the root folder) from their Google Drive.
 * 
 * @returns {Promise} a promise that resolves with the selected folder ID if the
 *   user chooses one, or never resolves if they cancel
 * @function
 */
export const showSaveFolderPicker = () => new Promise( ( resolve, reject ) => {
    gapi.load( 'picker', () => {
        const view = new google.picker.DocsView( google.picker.ViewId.FOLDERS )
        view.setMode( google.picker.DocsViewMode.LIST )
        view.setIncludeFolders( true )
        view.setSelectFolderEnabled( true )
        view.setMimeTypes( googleFolderMIMEType )
        const picker = new google.picker.PickerBuilder()
            .setTitle( 'Choose a folder in which to save your file' )
            .setDeveloperKey( window.LurchAPIKey )
            .setAppId( window.LurchClientId )
            .setOAuthToken( currentUser().getAuthResponse().access_token )
            .addView( view )
            .setCallback( event => {
                if ( event[google.picker.Response.ACTION] === google.picker.Action.PICKED ) {
                    const pickedItems = event[google.picker.Response.DOCUMENTS]
                    if ( pickedItems.length == 0 ) return reject()
                    resolve( {
                        id : pickedItems[0][google.picker.Document.ID],
                        name : pickedItems[0][google.picker.Document.NAME]
                    } )
                }
            } )
            .build()
        picker.setVisible( true )
        picker.V.style.zIndex += 5000 // hack to put it in front of TinyMCE
    } )
} )
