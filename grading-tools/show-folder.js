
/**
 * This file can be used to make it easier to grade student work.
 * If your students' files are in a folder heirarchy with root `/foo/bar`,
 * run this script as follows: `node grading-tools/show-folder.js /foo/bar`
 * 
 * It will print to the command line the URL to view the hierarchical list of
 * all files and folders under the given path that end with *.lurch/*.html, and
 * thus might be Lurch files.  You can click any one of them to open the file in
 * the copy of the app that is in this repository, for viewing and/or grading.
 */

// This code was modified from the answer to a StackOverflow question.
// https://stackoverflow.com/questions/16333790/node-js-quick-file-server-static-files-over-http
// Thank you!

import http from 'http'
import url from 'url'
import fs from 'fs'
import path from 'path'
const port = 8888

// Load stylesheet so we don't have to serve it dynamically, which would require
// us to figure out how to handle paths correctly from any possible root folder:
const CSS = fs.readFileSync( path.join(
    path.dirname( url.fileURLToPath( import.meta.url ) ),
    'file-list-styles.css' ) )

// Ensure the user passed one or more folders to us to display as student work:
const folders = process.argv.slice( 2 )
if ( folders.length == 0 ) {
    console.log( 'Usage: node show-folder.js <folder> [<folder> ...]' )
    process.exit()
}
folders.forEach( folder => {
    try {
        if ( !fs.statSync( folder ).isDirectory() ) {
            console.log( `${folder} is not a folder` )
            process.exit()
        }
    } catch ( e ) {
        console.log( `${folder} does not exist` )
        process.exit()
    }
} )

// Utility functions to generate the nested lists of folders and files:
const fileToHTML = ( name, fullPath ) => {
    // We encode the URI component TWICE here, for good reason:
    // 1. It must be encoded as a query string parameter, load=..., because on
    //    the other end, searchParams.get() will automatically decode it.
    // 2. When that is done, the decoded URL will be used in an XHR to fetch the
    //    file in question.  At that point, we cannot encode it again, because
    //    doing so would encode ALL its symbols, including the :// in http://,
    //    etc., making it no longer an URL but a single filename, unintended.
    // 3. Consequently, this server will receive that XHR with the folders in
    //    the path encoded ONCE (not twice, since searchParams.get() did one
    //    level of decoding) and we will therefore use decodeURIComponent() in
    //    the code for handling /grading/ URLs, later in this script.
    const encodedPath = path.join( path.sep, 'grading',
        encodeURIComponent( encodeURIComponent( path.resolve( fullPath ) ) ) )
    return `<div class="file">
        <a href="/index.html?load=${encodedPath}" target="_blank">${name}</a>
    </div>`
}
const folderToHTML = ( name, fullPath ) => {
    const contents = fs.readdirSync( fullPath ).map( name => {
        const inner = path.join( fullPath, name )
        if ( fs.statSync( inner ).isDirectory() )
            return folderToHTML( name, inner )
        else if ( name.endsWith( '.lurch' ) || name.endsWith( '.html' ) )
            return fileToHTML( name, inner )
        else
            return ''
    } ).join( '\n' )
    return `<div class="folder">
        <div class="folder-name">${name}</div>
        <div class="folder-contents">${contents}</div>
    </div>`
}
const foldersToHTML = fullPaths =>
    fullPaths.map( fullPath =>
        folderToHTML( fullPath, fullPath ) ).join( '\n' )
const generatePage = () => `
<html>
    <head><style>${CSS}</style>
        <link rel="shortcut icon" href="lurchmath/grading-tools/favicon.svg">
    </head>
    <body>
        <h1>Folders for grading</h1>
        ${foldersToHTML( folders )}
    </body>
</html>
`

// Create the server:
const server = http.createServer( ( req, res ) => {
    const parsedUrl = url.parse( req.url )
    let parts = path.parse( parsedUrl.pathname )
    parts = [ parts.root, ...parts.dir.split( path.sep ).slice( 1 ), parts.base ]
    let fileToLoad = null

    // Serve one of three things:
    // 1. If the request is empty, then our root is a nested list of links
    // representing the contents of the grading folder:
    if ( parts.slice( 1 ).every( part => part == '' ) ) {
        console.log( ` GENERATED: ${req.url}` )
        res.setHeader( 'Content-type', 'text/html' )
        res.end( generatePage() )
        return
    }
    // 2. If the request is for a file in /grading/..., then serve that file,
    // after removing the /grading/ prefix:
    if ( parts[1] == 'grading' ) {
        fileToLoad = path.join( parts[0], decodeURIComponent( parts[2] ) )
    }
    // 3. Every other request is for a file in the current folder:
    else {
        fileToLoad = path.join( '.', ...parts.slice( 1 ) )
    }

    const extensionToMime = {
        '.ico'  : 'image/x-icon',
        '.html' : 'text/html',
        '.js'   : 'text/javascript',
        '.json' : 'application/json',
        '.css'  : 'text/css',
        '.png'  : 'image/png',
        '.jpg'  : 'image/jpeg',
        '.wav'  : 'audio/wav',
        '.mp3'  : 'audio/mpeg',
        '.svg'  : 'image/svg+xml',
        '.pdf'  : 'application/pdf',
        '.doc'  : 'application/msword'
    }

    fs.stat( fileToLoad, error => {
        // for simplicity, I'm assuming an error means the file isn't there
        if ( error ) {
            console.log( ` NOT FOUND: ${req.url}` )
            res.statusCode = 404
            res.end( `File ${fileToLoad} not found!` )
            return
        }
    
        // if it's a directory, use its index.html file
        if ( fs.statSync( fileToLoad ).isDirectory() ) {
            if ( !fileToLoad.endsWith( '/' ) ) fileToLoad += '/'
            fileToLoad += 'index.html'
        }
    
        // read file from file system
        const ext = path.parse( fileToLoad ).ext
        fs.readFile( fileToLoad, ( err, data ) => {
            if ( err ) {
                // error getting file
                console.log( `READ ERROR: ${req.url}` )
                res.statusCode = 500
                res.end( `Error getting the file: ${err}.` )
            } else {
                // found; send type and data
                console.log( `    SERVED: ${req.url}` )
                res.setHeader( 'Content-type', extensionToMime[ext] || 'text/plain' )
                res.end( data )
            }
        } )
    } )

} )

// Start the server, or give a useful error if you can't:
server.on( 'error', err => {
    if ( /address already in use/.test( `${err}` ) ) {
        console.log( `Cannot launch server; port ${port} is in use.` )
        process.exit()
    } else {
        throw err
    }
} )
server.listen( port )
console.log( `
-----
Visit http://localhost:${port} to view files for grading.
-----
` )
