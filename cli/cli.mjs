
// This is the command-line interface for Lurch.
// It is still minimally documented and someone should come back and document
// it later.

import {
    openApp, openDocument, validationResults, documentHTML, documentAsPDF
} from './headless-lurch.mjs'
import chalk from 'chalk'
import { statSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import chokidar from 'chokidar'

// Figure out what arguments and switches have been passed to us
// and yell if any of them are invalid

const validCommands = [ 'html', 'html-only', 'pdf', 'no-table', 'watch' ]
const usage = () => {
    console.error( 'Usages: node [optional switches] cli.mjs <file>' )
    console.error( '    or: node [optional switches] cli.mjs <folder>' )
    console.error( '    or: node [optional switches] cli.mjs <srcfolder> <destfolder>' )
    console.error( 'Valid switches: '+validCommands.map(x=>'--'+x).join( ', ' ) )
}
// drop "node cli.mjs" off the list off the args list:
const args = process.argv.slice( 2 )
// find all switches and ensure they're valid
const commands = [ ]
for ( let i = 0 ; i < args.length ; ) {
    if ( args[i].startsWith( '--' ) ) {
        commands.push( args.splice( i, 1 )[0].substring( 2 ) )
    } else {
        i++
    }
}
if ( commands.some( command => !validCommands.includes( command ) ) ) {
    usage()
    process.exit()
}
// figure out what mode we're in and make sure they didn't specify >1 mode
if ( ( commands.includes( 'html' ) ? 1 : 0 )
   + ( commands.includes( 'html-only' ) ? 1 : 0 )
   + ( commands.includes( 'pdf' ) ? 1 : 0 ) > 1 ) {
    console.error( 'Error: --html, --html-only, and --pdf are mutually exclusive' )
    process.exit()
}
const mode = commands.includes( 'html-only' ) ? 'html-only' :
             commands.includes( 'html' ) ? 'html' :
             commands.includes( 'pdf' ) ? 'pdf' : 'text'
const table = !commands.includes( 'no-table' )
// figure out if we're watching a folder, and if so, we must be in text mode
const watch = commands.includes( 'watch' )
if ( watch && mode != 'text' ) {
    console.error( 'Error: cannot watch a folder with --'+mode )
    process.exit()
}
// ensure the post-switch args are either one file, one folder, or two folders
if ( args.length == 2 ) {
    if ( !statSync( args[0] ).isDirectory() ) {
        console.error( 'Error: '+args[0]+' is not a directory' )
        process.exit()
    }
    if ( !statSync( args[1] ).isDirectory() ) {
        console.error( 'Error: '+args[1]+' is not a directory' )
        process.exit()
    }
    if ( mode == 'text' ) {
        console.error( 'Error: Cannot convert one directory to another as --text' )
        process.exit()
    }
} else if ( args.length != 1 ) {
    usage()
    process.exit()
}

// The following routine prints out one validation result.
// It will be called repeatedly when validation results have come back and need
// to be printed.  See below where it is used.
const eighty = '                                        '
             + '                                        '
const printResult = result => {
    let indent = ''
    for ( let i = 0 ; i < result.depth ; i++ ) indent += '    '
    const type = chalk.gray( result.type )
    const repr = chalk.inverse(
        result.given ? `Given $${result.latex}$` :
        result.contentType == 'Statement' ? '`'+result.lurch+'`' :
        result.contentType == 'Assumption' ? 'Assume `'+result.lurch+'`' :
        result.contentType && result.lurch ?
            `${result.contentType}: ${result.symbol}, ${result.lurch}` :
        result.contentType ? `${result.contentType}: ${result.symbol}` :
        result.lurch ? '`'+result.lurch+'`' :
        result.latex ? '$'+result.latex+'$' : ''
    )
    const validation =
        !result.result ? '' :
        result.result == 'valid' ? chalk.bgGreen( ' ✓ valid ' ) :
        result.result == 'invalid' ? chalk.bgRed( ' ✗ invalid ' ) :
        result.result == 'indeterminate' ? chalk.bgYellow( ' ? indeterminate ' ) :
        chalk.bgRed( ' ! error ' )
    if ( table ) {
        console.log( ( `${indent}${type}: ${repr}` + eighty ).substring( 0, 60 )
            + validation )
    } else {
        console.log( `${indent}${type}: ${repr}${validation}` )
    }
}

// This is the main body of the script.
// It is marked async because it needs to communicate with a headless browser
// containing the Lurch app, which requires waiting for stuff to happen in the
// browser, using await.
;( async () => {

    // Tell the headless browser to load the Lurch app
    console.log( chalk.green( 'Launching invisible Lurch app...' ) )
    await openApp()

    // Case 1: We're handling one file or one folder
    if ( args.length == 1 ) {
        const path = args[0]
        const stat = statSync( path )

        // Case 1a: We're handling one folder
        if ( stat.isDirectory() ) {
            if ( mode != 'text' ) {
                // We have to be in text mode to process a whole folder
                console.error( 'Error: Cannot process a directory with --'+mode )
                process.exit()
            } else if ( watch ) {
                // If we're watching the folder, launch the file-system-watching
                // tool "chokidar" to do that job.
                console.log( chalk.green( 'Watching ' + path ) )
                const watcher = chokidar.watch( path, {
                    persistent : true,
                    ignoreInitial : true
                } )
                // Any time we hear about a file change, validate that file and
                // print the results.
                const handler = async ( path ) => {
                    if ( !path.endsWith( '.md' ) && !path.endsWith( '.html' ) )
                        return
                    await openDocument( path )
                    // The following line may seem odd, but here's why it matters:
                    // If a previous document was loaded, then we load a new one,
                    // the deletion of a ton of atoms causes clearing of all
                    // validation results.  So we have to pause for a moment to
                    // let that happen before we try to revalidate, or they might
                    // happen in the wrong order, and all our validation results
                    // get erased right after they're created.
                    await new Promise( resolve => setTimeout( resolve, 100 ) )
                    const results = await validationResults()
                    console.log( chalk.bold( path + ':' ) )
                    results.forEach( printResult )
                }
                watcher.on( 'add', handler )
                watcher.on( 'change', handler )
            } else {
                // We're not watching the folder, so just process everything in
                // it once (well, each .md or .html file): read and validate it.
                const files = readdirSync( path )
                for ( let i = 0 ; i < files.length ; i++ ) {
                    if ( files[i].endsWith( '.md' ) || files[i].endsWith( '.html' ) ) {
                        const fullPath = join( path, files[i] )
                        await openDocument( fullPath )
                        const results = await validationResults()
                        console.log( chalk.bold( fullPath + ':' ) )
                        results.forEach( printResult )
                    }
                }
                process.exit()
            }

        // Case 1b: We're handling one file
        } else if ( stat.isFile() ) {
            // Open the given file and do whatever the mode says
            await openDocument( path )
            if ( mode == 'html-only' ) {
                // just print the HTML without validating
                console.log( await documentHTML() )
            } else if ( mode == 'html' ) {
                // validate and then print the HTML, with validation results in it
                await validationResults()
                console.log( await documentHTML() )
            } else if ( mode == 'pdf' ) {
                // validate and then print to PDF, with validation results in it
                await validationResults()
                const pdf = await documentAsPDF()
                const extension = path.split( '.' ).pop()
                const outfile = path.substring( 0, path.length - extension.length - 1 ) + '.pdf'
                writeFileSync( outfile, pdf )
                console.log( chalk.green( 'Wrote ' + outfile ) )
            } else { // mode == 'text'
                // validate and then print the validation results only
                const results = await validationResults()
                results.forEach( printResult )
            }
            process.exit()

        // Case 1c: The file/folder given to us is not actually valid
        } else {
            console.error( 'Error: '+path+' is not a valid file or directory' )
            process.exit()
        }
    
    // Case 2: We're handling two folders, a source and a destination
    } else {
        const srcPath = args[0]
        const destPath = args[1]

        // Get the list of all files in the source folder
        const files = readdirSync( srcPath )
        for ( let i = 0 ; i < files.length ; i++ ) {
            // We only care about .md and .html files
            if ( files[i].endsWith( '.md' ) || files[i].endsWith( '.html' ) ) {
                // Read the source file, optionally validate it, and write it as
                // HTML into the new folder, then print out that we did so.
                const srcFullPath = join( srcPath, files[i] )
                const destFullPath = join( destPath, files[i].replace( /\.md$/, '.html' ) )
                console.log( `Reading: ${srcFullPath}...` )
                await openDocument( srcFullPath )
                if ( mode == 'html' ) { await validationResults() }
                const html = await documentHTML()
                writeFileSync( destFullPath, html )
                console.log( `      -> ${destFullPath} (done)` )
            }
        }
        process.exit()
    }

} )()
