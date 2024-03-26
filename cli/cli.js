
/**
 * @file The Lurch command-line interface (CLI)
 * 
 * You can run this module from the command line in the repository root via
 * `node cli/cli.js`, passing arguments as documented below.  There are
 * several use cases for this command-line interface.
 * 
 * **NOTE:** If you do not have Chromium installed so that the puppeteer module
 * can find it, this CLI will not work.  If you are using the development
 * container for this repository as defined in
 * {@link https://github.com/lurchmath/lurchmath/blob/master/.devcontainer/Dockerfile
 * its Dockerfile}, Chromium is already installed for you.
 * 
 * ## Use case 1: Writing Lurch documents in Markdown
 * 
 * Some users prefer to write documents in Markdown, for (some subset of) the
 * following reasons.
 * 
 *  * They want to be able to edit the document in a text editor
 *  * They type more quickly when they do not need to use menu items or dialog
 *    boxes to insert their content
 *  * They want to check their source documents into version control in an easy,
 *    human-readable format
 * 
 * In addition, this command-line interface makes it easy to import one file
 * into another as a dependency, which is a feature that (at the time this tool
 * was invented, February 2024) has only partial support in the full Lurch web
 * application.  (One can embed dependencies, but cannot recursively refresh
 * them when the dependencies change.)  For that reason, this tool has some
 * temporary benefits that the full Lurch app does not have.
 * 
 * To use the CLI in this way, just run it on a single input file, which can be
 * a markdown file (ending in `.md`) or an HTML file (ending in `.html`) in
 * either of two formats (simplified HTML or long-form HTML, described below).
 * 
 * `node cli/cli.js path/to/your-file.md`
 * 
 * This mode will convert your file into standard Lurch form, load it into an
 * invisible copy of the full Lurch web app running in a headless Chromium
 * browser, validate the document, and then print to the console the results of
 * that validation process, indented in a way that mimics the structure of
 * nested environments in your document.  Here is an example, without any of
 * the colors that are used in the actual terminal output:
 * 
 * ```
 *     rule:
 *         expression: `Assume A and B`
 *         expression: `A`
 *         expression: `B`
 *     expression: `Assume X and Y`
 *     expression: `Y`                       ✓ valid 
 *     expression: `Z`                       ? indeterminate 
 * ```
 * 
 * ## Other output formats
 * 
 * If you do not want the output in this human-readable, simple, text form, you
 * can ask for HTML output instead, which shows the long-form HTML that is
 * stored in the actual Lurch app editor.  Do so with the following command:
 * 
 * `node cli/cli.js --html path/to/your-file.md`
 * 
 * This type of output is suitable for redirecting to an `.html` file that can
 * then be opened by the main Lurch app.  It will include the results of
 * validation, but if you want the HTML without the validation results, use the
 * `--html-only` switch instead of `--html`.  For example, to redirect to an
 * HTML file and exclude validation results, use the following form.
 * 
 * `node cli/cli.js --html-only path/to/your-file.md > output-file.html`
 * 
 * If you would like to create a readable representation of the document for a
 * non-technical audience, you can output to PDF.  This mode of the CLI will
 * automatically save the file into the same location as the input file, but
 * with a `.pdf` extension.  The PDF is just a direct capture of the Lurch app
 * running in the headless Chromium, with your document loaded and validated.
 * 
 * `node cli/cli.js --pdf path/to/your-file.md`
 * 
 * ## Simplified HTML vs. long-form HTML
 * 
 * Writing a Lurch document typically includes mathematical content like
 * theorems, proofs, expressions, etc.  In the main Lurch app, these are stored
 * as complex HTML tags that are appropriate for rendering and editing by the
 * Lurch app, but are not human-readable nor easy to create.  To make it easier
 * to create such content, we have the concept of "simplified HTML," which means
 * that we provide simple HTML tags with common mathematical meanings, that can
 * be programmatically converted on your behalf into the more complex format
 * that the app uses internally.
 * 
 * Specifically, if you view {@link module:EmbedListener the module supporting
 * embedded copies of the Lurch app,} its documentation describes how one can
 * write tags of the form `<lurch>...</lurch>`, `<latex>...</latex>`,
 * `<theorem>...</theorem>`, and others that represent meaningful mathematics in
 * a compact way.  Those tags are supported in both HTML and Markdown inputs to
 * the CLI.  Just as that documentation page describes support for the document
 * header using a DIV of class "header," the CLI supports that as well.
 * 
 * That documentation also points out that, in Markdown input, the user can use
 * inline Markdown code (surrounded in backticks) to represent expressions in
 * Lurch notation, and can use inline LaTeX code (surrounded in dollar signs)
 * to represent expository mathematics (that is, mathematics that is to be
 * typeset and displayed, but not interpreted as part of the user's proof).
 * 
 * To see example Lurch documents written in Markdown using these conventions,
 * refer to {@link https://github.com/lurchmath/lurchmath.github.io/tree/master/docs
 * the source code for our documentation,} which includes many tutorial pages
 * with embedded copies of Lurch, each of which has its own document written in
 * Markdown.
 * 
 * In addition to the features document on that page, the CLI also supports
 * importing other documents into the one being processed by the CLI.  Use an
 * HTML tag of the form `<import src="relative path"/>` to do so.  Imports can
 * be recursive, and circular dependency chains generate errors.  It is common
 * to place such "import" tags in the document header, as described above, in a
 * form that looks like the following.
 * 
 * ```html
 * <div class="header">
 *     <import src="path/to/some-import.md"/>
 *     <import src="path/to/another-import.md"/>
 * </div>
 * ```
 * 
 * ## Use case 2: Validating existing Lurch documents
 * 
 * It is unlikely that the user will want to author documents in the long-form
 * HTML format, because it is an internal storage format that is far less
 * human-readable.  But if the user already has a Lurch document saved from the
 * app itself, and thus in the long-form HTML format, you can pass it to the CLI
 * to have it validated.
 * 
 * `node cli/cli.js path/to/your-file.html`
 * 
 * The output is the same as when Markdown input is given; it will be indented
 * text output of the validation results.  To instead see the output as HTML,
 * so that you could use it to replace the original document, for example, use
 * the `--html` switch mentioned earlier.
 * 
 * ## Use case 3: Validating an entire folder
 * 
 * If you run the command on a folder instead of a single file, the CLI will
 * validate all the files in that folder, and print the results to the console.
 * In this mode, you can use only the default output format (indented text, as
 * shown above), which will be supplemented with a filename above each section
 * of output.  (The HTML output forms are typically for redirecting to a file,
 * and thus do not make sense in this context.)
 * 
 * `node cli/cli.js path/to/your-folder`
 * 
 * ## Use case 4: Watching for changes
 * 
 * If you run the command on a folder, you can pass the `--watch` switch to
 * tell the CLI not to immediately process all the files in the folder, but to
 * watch for changes to the folder itself.  The CLI will respond whenever a file
 * is added to the folder or when the contents of a file change; in each case,
 * it will read the new or changed file and process it in the default way
 * described above (printing validation results in text form, indented).
 * 
 * In this mode, the CLI does not exit until the user kills the process.  It
 * remains running so that you can use it to get constant, up-to-the-moment
 * feedback on your recently saved edits.  You can exit it with Ctrl+C, as with
 * any CLI tool.
 * 
 * The `--watch` switch is not compatible with the `--html` or `--html-only`
 * switches because their output is not human-readable, and the goal of the
 * `--watch` switch is to provide a way for the user to edit a document and,
 * each time they save, see the latest validation results.  Thus the only output
 * format that makes sense is the default one.
 * 
 * `node cli/cli.js --watch path/to/your-folder`
 * 
 * ## Use case 5: Converting an entire folder
 * 
 * If you run the CLI on two folders, they are treated as a source and a
 * destination folder.  The CLI will convert all the files in the source folder
 * to HTML, and write the results to the destination folder using the same
 * filenames, but with each extension changed to `.html`.  The output form is
 * long-form HTML, meaning that it is ready to be opened in the main Lurch app.
 * 
 * `node cli/cli.js path/to/your-source-folder path/to/your-destination-folder`
 * 
 * In this way, the user can write an entire library of mathematical documents
 * with dependencies among one another in a single folder, in a convenient
 * format like Markdown, and just occasionally compile them into the format used
 * in the main Lurch app, for distribution to users of that app.
 * 
 * This module is supported by {@link module:HeadlessLurch the headless Lurch
 * module}.
 * 
 * @module CLI
 */

import {
    openApp, openDocument, validationResults, documentHTML, documentAsPDF
} from './headless-lurch.js'
import chalk from 'chalk'
import { statSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import chokidar from 'chokidar'

// Figure out what arguments and switches have been passed to us
// and yell if any of them are invalid

const validCommands = [ 'html', 'html-only', 'pdf', 'no-table', 'watch' ]
const usage = () => {
    console.error( 'Usages: node [optional switches] cli.js <file>' )
    console.error( '    or: node [optional switches] cli.js <folder>' )
    console.error( '    or: node [optional switches] cli.js <srcfolder> <destfolder>' )
    console.error( 'Valid switches: '+validCommands.map(x=>'--'+x).join( ', ' ) )
}
// drop "node cli.js" off the list off the args list:
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
