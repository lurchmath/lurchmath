
import { loadScript } from './utilities.js'

const GoogleDriveAPI = 'https://apis.google.com/js/api.js'
const GoogleSignInAPI = 'https://apis.google.com/js/platform.js'
const discoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const fileScope = 'https://www.googleapis.com/auth/drive.file'
const uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const googleFolderMIMEType = 'application/vnd.google-apps.folder'
const lurchMimeType = 'text/html'

loadScript( window.location.hostname == 'localhost' ?
            'google-api-key-secret.js' :
            'google-api-key-public.js' ).then( () => {
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

const currentUser = () =>
    gapi.auth2.getAuthInstance().currentUser.get()

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

export const readFileFromDrive = fileId => gapi.client.drive.files.get( {
    fileId : fileId,
    alt : 'media'
} )

export const writeFileToDrive = ( filename, folderId, content ) => {
    var metadata = {
        name : filename,
        mimeType : lurchMimeType,
        parents : [ folderId ]
    }
    var formData = new FormData()
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
