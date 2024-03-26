
/**
 * @file Utilities needed by the command-line interface
 * 
 * This module is a set of auxiliary tools required by {@link module:CLI the
 * command-line interface}.  See that module's documentation for how to use the
 * CLI, or this module's documentation for what it provides.
 * 
 * The main purpose here is to launch two invisible background services that the
 * CLI can leverage:
 * 
 *  1. a web server that serves the Lurch app from this repository, so that any
 *     browser running on the local machine can access it, and
 *  2. a headless Chromium browser that runs the Lurch app from that server.
 * 
 * This module provides many functions for interacting with the copy of the
 * Lurch app in the headless Chromium browser, for putting content in, and
 * getting responses back, including the document in various forms, and the
 * results of validation run in the app.
 * 
 * Typically, the CLI will use the functions in this module in this order:
 * 
 *  * Create an invisible, running copy of the Lurch app with
 *    {@link module:HeadlessLurch.openApp openApp()}.
 *  * Load a document into the app with
 *    {@link module:HeadlessLurch.openDocument openDocument()}.
 *  * Validate the document and return the validation results with
 *    {@link module:HeadlessLurch.validationResults validationResults()}.
 *  * Possibly repeat the above two steps or some subset of them many times.
 *  * Optionally get the document in PDF form with
 *    {@link module:HeadlessLurch.documentAsPDF documentAsPDF()}.
 *  * Optionally close the app with
 *    {@link module:HeadlessLurch.closeApp closeApp()}.
 * 
 * @module HeadlessLurch
 */

import puppeteer from 'puppeteer'
import chalk from 'chalk'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { startServer } from './simple-server.js'

// We need to be running a simple web server so that the headless browser has
// a place from which to load the Lurch app
const port = 8080
startServer( { verbose : false, port : port } )

// All the functions below refer to these same module-global variables
let browser = null
let page = null

/**
 * Open the browser, launch a page, load the Lurch app into that page, and
 * wait until the app is fully loaded.  A few meessages will be printed to the
 * console while that happens, so that users of the CLI will know what's going
 * on during the noticeable delay it takes to launch the app.
 * 
 * @function
 */
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

/**
 * Close the headless Chromium that's running the Lurch app.  Although this
 * function is provided for completeness, as a twin to
 * {@link module:HeadlessLurch.openApp openApp()},
 * the CLI does not actually use it, because it just closes the entire CLI when
 * it's complete, which implicitly shuts down this resource.
 * 
 * @function
 */
export const closeApp = async () => {
    await browser.close()
    console.log( chalk.green( 'Invisible Lurch app closed' ) )
}

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

/**
 * Long form HTML is the type of HTML saved by the Lurch app.  We call it "long
 * form" because each atom in the document (which has a very small appearance on
 * screen) has a rather large appearance in the HTML content, because that
 * content contains all the atom's internal properties, as well as all of the
 * HTML necessary to represent its typeset form on screen (which can be complex).
 * 
 * There is also a more compact way to represent Lurch documents using HTML tags,
 * as documented in {@link module:EmbedListener the embed-listener.js module}.
 * This function takes a string of HTML as input and detects whether it is an
 * HTML file that was saved from the Lurch app (long form) or not (assumed
 * therefore to be short form).
 * 
 * @param {string} html - the HTML to test to see whether it is in long form
 * @returns {Promise<boolean>} whether the given HTML is in long form
 * 
 * @function
 */
export const isLongForm = async ( html ) => {
    return await page.evaluate( `
        window.tinymce.activeEditor.lurchDocument.constructor.isDocumentHTML(
            ${JSON.stringify( html )}
        )
    ` )
}

/**
 * Run validation on the document currently in the Lurch app, wait until that
 * validation completes, then find every atom (which includes shells) in the
 * document anbd extract its key information.  The result (when the promise
 * resolves) is an array of objects with the following fields.
 * 
 *  * `type` - the type of atom (e.g., "expression" or "theorem" etc.)
 *  * `result` - the validation result (e.g., "valid" or "invalid")
 *  * `depth` - the nesting depth of the atom, an integer greater than 0
 *  * `lurch` - the meaning of the atom, in Lurch notation, if it is the type of
 *    atom that has a meaning in Lurch notation (e.g., an expression written
 *    using the intermediate or advanced version of the editor)
 *  * `latex` - the LaTeX representation of the atom (which may mean that it is
 *    an expository math atom, and thus has no meaning, or it may mean that it
 *    is an expression created by the beginner version of the editor, and thus
 *    its content was expressed in LaTeX created by MathLive)
 *  * `given` - `true` if the atom is an assumption and was created by the
 *    beginner version of the editor
 *  * `contentType` - a string representing the type of expression, if it is an
 *    expression created by the intermediate version of the editor (which permits
 *    content types "Statement", "Assumption", and various forms of declaration)
 *  * `symbol` - the symbol being declared, if the atom is a declaration built
 *    using the intermediate form of the expression editor
 * 
 * @returns {Promise<Object[]>}
 * 
 * @function
 */
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

/**
 * Read a document from the filesystem, recursively obeying any "import" tags
 * inside it (and throwing an error if any circular dependencies are detected),
 * then load the resulting document into the Lurch app in one of three ways:
 *  * If the file is an HTML file, and it is detected to be in long form (the
 *    type saved by the Lurch app) using
 *    {@link module:HeadlessLurch.isLongForm isLongForm()},then
 *    load it directly into the app with no changes.
 *  * If the file is an HTML file, but it is not detected to be in long form,
 *    then assume it contains simplified HTML, and provide it to the app as if
 *    the app were an embedded copy of the Lurch app, so that the HTML content
 *    will be processed by {@link module:EmbedListener the embed-listener.js module}.
 *    This will expand tags of the form `<lurch>...</lurch>`,
 *    `<theorem>...</theorem>`, and so on into their full internal
 *    representations.
 *  * If the file is a Markdown file, do the same as in the previous bullet
 *    point, because {@link module:EmbedListener the embed-listener.js module}
 *    supports Markdown as well.
 *
 * @param {string} filename - the file to load from the filesystem
 * 
 * @function
 */
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

/**
 * Get the full contents of the current Lurch app, in the same long-form HTML
 * that would be saved if the user invoked Save from the app's File menu.
 * 
 * @returns {Promise<string>} the contents of the document (in long-form HTML)
 * 
 * @function
 */
export const documentHTML = async () => {
    return await page.evaluate( () => {
        return window.tinymce.activeEditor.lurchDocument.getDocument()
    } )
}

/**
 * Get the appearance of the document in the app in the headless browser,
 * represented as a PDF.  The return value is the content that belongs in a PDF
 * file, which can then be written to a `.pdf` file on disk.
 * 
 * @returns {Promise<Buffer>} a buffer containing the contents of a PDF file
 * 
 * @function
 */
export const documentAsPDF = async () => {
    return await page.pdf()
}
