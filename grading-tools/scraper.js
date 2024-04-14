/**
 * This is just a utility that uses the folder-traversing mechanisms of the
 * tools in this folder to scrape all available .lurch files and output a file
 * `scrape.txt` containing all of the input notation in the atoms in those files.
 */

import url from 'url'
import fs from 'fs'
import path from 'path'

// Load stylesheet so we don't have to serve it dynamically, which would require
// us to figure out how to handle paths correctly from any possible root folder:
const CSS = fs.readFileSync( path.join(
    path.dirname( url.fileURLToPath( import.meta.url ) ),
    'file-list-styles.css' ), 'utf8' )

// We can assume that for an LFY the root folder of the server contains
// the lurchmath repo as one of its subfolder.
const rootFolder = path.resolve(url.fileURLToPath( import.meta.url ),'../../..')

// Utility functions to generate the nested lists of folders and files:
const fileToHTML = ( name, relPath ) => {
    const relPathName = path.join( path.sep, relPath , name )
    const filename = path.resolve(rootFolder, relPath, name )
    const content = String( fs.readFileSync( filename ) )
    const re = RegExp( 'data\\-metadata_lurch\\-notation="([^"]+)"', 'g' )
    let match, ans=''
    while ( match = re.exec( content ) )
    	ans += JSON.parse( match[1]
    		.replaceAll( '&#039;', "'" )
          .replaceAll( '&quot;', '"' )
          .replaceAll( '&gt;', '>' )
          .replaceAll( '&lt;', '<' )
          .replaceAll( '&amp;', '&' ) ).replaceAll( '\n', '\\n' )+'\n'

    return ans
}

const folderToHTML = ( name, relPath ) => {
    const fullPath = path.resolve(rootFolder,relPath)
    const contents = fs.readdirSync( fullPath ).map( name => {
        const fullinner = path.join( fullPath, name )
        const inner = path.join( relPath, name )
        if ( fs.statSync( fullinner ).isDirectory() )
            return folderToHTML( name, inner )
        else if ( name.endsWith( '.lurch' ) ) 
            return fileToHTML( name, relPath )
        else
            return ''
    } ).filter(s => (typeof s === 'string' && s!=='') ).join( '\n' )
    return contents
}

const foldersToHTML = relPaths => 
    relPaths.map( relPath => folderToHTML( relPath, relPath ) ).join( '\n' )
  
export const scrape = (...folders) => {
    if (folders.length == 0) folders = ['.']
    const page = foldersToHTML( folders )

    const scrapefile = path.join( path.sep , rootFolder, 'scrape.txt')
    fs.writeFile(scrapefile, page, (err) => {
        if (err) { 
            console.error(err) 
            return 
        }
      })
    write(`The Lurch expression scrape file was written successfully to \n${scrapefile}.`)
    return 
}
