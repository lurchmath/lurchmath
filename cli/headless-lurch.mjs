
// This is a module used by the command-line interface to Lurch.
// It just provides a bunch of tools for loading an invisible headless Chromium
// containing a copy of the Lurch app, and communicating with that app.
// I should come back and document this better later, much like the CLI itself.

import puppeteer from 'puppeteer'
import chalk from 'chalk'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// We need to be running a simple web server so that the headless browser has
// a place from which to load the Lurch app
const port = 8080
import( './simple-server.cjs' ).then( module =>
    module.startServer( { verbose : false, port : port } ) )

// All the functions below refer to these same module-global variables
let browser = null
let page = null

// Open the browser, launch a page, load the Lurch app into that page, and
// wait until the app is fully loaded, printing a few messages to the console
// while that happens so that people know what's going on during the delay.
export const openApp = async () => {
    browser = await puppeteer.launch( {
        args : [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    } )
    page = await browser.newPage()
    page.on( 'console', message =>
        console.log( chalk.yellow( message.type().substring(0, 3).toUpperCase() )
            + ' ' + message.text() ) )
    page.on( 'pageerror', error =>
        console.log( chalk.red( `Page error: ${error}` ) ) )
    // page.on( 'response', response =>
    //     console.log( `${response.status()} ${response.url()}` ) )
    page.on( 'requestfailed', request =>
        console.log( chalk.red( `${request.failure().errorText} ${request.url()}` ) ) )
    await page.goto( `http://localhost:${port}/index.html?actAsEmbed=true`,
        { timeout : 0 } )
    await page.waitForFunction( () => window?.tinymce?.activeEditor?.lurchDocument )
    console.log( chalk.green( 'Invisible Lurch app opened' ) )
}

// export const closeApp = async () => {
//     await browser.close()
//     console.log( chalk.green( 'Invisible Lurch app closed' ) )
// }

// Invoke the validation menu item in the app and wait until we can detect that
// validation actually completed.
const validateAndWait = async () => {
    await page.evaluate( () => {
        window.validationFinished = false
        window.tinymce.activeEditor.once( 'validationFinished', () =>
            window.validationFinished = true )
        window.tinymce.activeEditor.ui.registry.getAll().menuItems.validate.onAction()
    } )
    await page.waitForFunction( () => window.validationFinished )
}

// Use the tools in the app to detect whether a piece of HTML text is in the
// "long form" (that is, the form that could be loaded directly into the Lurch
// app) as opposed to simplified form (the form that's easier to write, and is
// supported by embed-listener.js).
export const isLongForm = async ( html ) => {
    return await page.evaluate( `
        window.tinymce.activeEditor.lurchDocument.constructor.isDocumentHTML(
            ${JSON.stringify( html )}
        )
    ` )
}

// Run validation using the above validateAndWait() function, then look through
// the editor in the app and find all atoms in it.  For each one, extract its
// key information (type, nesting depth, meaning, validation results, etc.) and
// return an array of objects with that information, one object for each atom,
// in the order the appear in the document.
export const validationResults = async () => {
    await validateAndWait()
    return await page.evaluate( () => {
        const Atom = window.tinymce.activeEditor.Atom
        const allResults = [ 'valid', 'invalid', 'indeterminate', 'error' ]
        const atomType = atom => JSON.parse( atom.element.dataset['metadata_type'] )
        const oneResult = atom => {
            // Handle the case of a block atom, which will have an attribute like:
            // <div data-validation-result="valid"...></div>
            if ( atom.element.dataset['data-validation-result'] )
                return atom.element.dataset['data-validation-result']
            // Handle the case of an inline atom, whose suffix will contain approx:
            // <span class='feedback-marker-valid'>&nbsp;</span>
            for ( let i = 0 ; i < allResults.length ; i++ )
                if ( atom.element.querySelector( '.feedback-marker-'+allResults[i] ) )
                    return allResults[i]
        }
        const nestingDepth = node => !node ? 0 :
            Atom.isAtomElement( node ) ? 1 + nestingDepth( node.parentNode ) :
            nestingDepth( node.parentNode )
        return Atom.allIn( window.tinymce.activeEditor ).map( atom => { return {
            type : atomType( atom ),
            result : oneResult( atom ),
            depth : nestingDepth( atom.element ),
            lurch : atom.getMetadata( 'lurchNotation' ),
            latex : atom.getMetadata( 'latex' ),
            given : atom.getMetadata( 'given' ),
            contentType : atom.getMetadata( 'contentType' ),
            symbol : atom.getMetadata( 'symbol' )
        } } )
    } )
}

// Read a document from a file, and if it contains any <import src="..."/> tags,
// replace them with the content of the referenced file, by calling this function
// recursively.  If any circular dependencies are detected, throw an error.
// Return the contents of the document as a string, which may not be the actual
// contents on disk if any imports were done.
let filesRead = null
const importRE = /<import\s+src="([^"]*)"\s*\/>|<import\s+src='([^']*)'\s*\/>/
const readDocumentWithImports = ( filename, topLevelCall = true ) => {
    if ( topLevelCall ) filesRead = [ ]
    if ( filesRead.includes( filename ) )
        throw new Error( 'Circular import detected.' )
    let result = readFileSync( filename, 'utf8' )
    filesRead.push( filename )
    let match = null
    while ( match = importRE.exec( result ) ) {
        const relativeFile = match[1] || match[2]
        const absoluteFile = join( dirname( filename ), relativeFile )
        const importContents = readDocumentWithImports( absoluteFile, false )
        result = result.replace( match[0], importContents )
    }
    return result
}

// Read a document from a file, load that document into the Lurch app, and wait
// until the load has completed before returning.  This supports three types of
// files:
// - Lurch .html files just like those saved from the app
// - other .html files containing simplified HTML, like the format supported by
//   embed-listener.js
// - Markdown (.md) files containing content like that supported by embed-listener.js
export const openDocument = async ( filename ) => {
    await page.evaluate( () => {
        window.atomUpdateFinished = false
        window.tinymce.activeEditor.once( 'atomUpdateFinished', () =>
            window.atomUpdateFinished = true )
    } )
    const contents = readDocumentWithImports( filename )
    if ( filename.endsWith( '.md' ) ) {
        // markdown needs to be interpreted by the embed-listener.js script,
        // so we send a lurch-embed message with the markdown in it
        const stringified = JSON.stringify( `<div format='markdown'>${contents}</div>` )
        await page.evaluate( `
            window.postMessage( { 'lurch-embed' : ${stringified} }, '*' )
        ` )
    } else if ( filename.endsWith( '.html' ) ) {
        if ( await isLongForm( contents ) ) {
            // long form means that the HTML content is already in the form used
            // natively by Lurch, so no conversion needs to happen; we can just
            // use the contents from the file as the Lurch document directly
            await page.evaluate( `
                window.tinymce.activeEditor.lurchDocument.setDocument(
                    ${JSON.stringify( contents )}
                )
            ` )
        } else {
            // short form means that the HTML content is abbreviated, and needs
            // to be expanded in a way similar to the markdown format above, so
            // we employ a very similar strategy
            const stringified = JSON.stringify( `<div format='html'>${contents}</div>` )
            await page.evaluate( `
                window.postMessage( { 'lurch-embed' : ${stringified} }, '*' )
            ` )
        }
    } else {
        throw new Error( 'Unsupported file type: ' + filename )
    }
    await page.waitForFunction( () => window.atomUpdateFinished )
}

// Ask the headless Lurch app for the contents of the document, wait for a
// response, and then return that.
export const documentHTML = async () => {
    return await page.evaluate( () => {
        return window.tinymce.activeEditor.lurchDocument.getDocument()
    } )
}

// Ask the browser window to print itself to PDF, and return the result as a
// buffer, which can be written to a .pdf file on disk.
export const documentAsPDF = async () => {
    return await page.pdf()
}
