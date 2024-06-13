
/**
 * This file provides a function for initiating the download of a file, plus a
 * {@link Dialog} component for initiating the upload of a file.
 * 
 * @module DownloadUpload
 */

import { LurchDocument } from './lurch-document.js'
import { isValidURL } from './utilities.js'

/**
 * Immediately initiates the download of the contents of the Lurch document
 * stored in the given TinyMCE editor.  Technically, it creates an invisible
 * link that would initiate the download, clicks that link, and then discards
 * it.
 * 
 * If a filename is not provided, it is lifted from the document, and if none is
 * there, a default one is provided.
 * 
 * @param {tinymce.editor} editor - the editor whose contents should be
 *   downloaded
 * @param {string} [filename] - the initial name of the file to include in the
 *   download dialog (though the user can change this)
 */
export const downloadFile = ( editor, filename ) => {
    const LD = new LurchDocument( editor )
    const content = LD.getDocument()
    const anchor = document.createElement( 'a' )
    anchor.setAttribute( 'href', 'data:text/html;charset=utf-8,'
        + encodeURIComponent( content ) )
    if ( !filename )
        filename = LD.getFileID() || 'lurch-document.lurch'
    if ( filename.startsWith( 'file:///' ) )
        filename = filename.slice( 8 )
    else if ( isValidURL( filename ) )
        filename = filename.split( '/' ).pop()
    anchor.setAttribute( 'download', filename )
    document.body.appendChild( anchor )
    anchor.click()
    anchor.remove()
}

/**
 * An item that can be used in a {@link Dialog} to allow the user to upload a
 * file.  It creates HTML content with two DIVs, one that permits dragging and
 * dropping of files onto the dialog to upload them, and the other of which
 * contains a button you can click to choose a file.
 * 
 * Whenever the user chooses a file, the file's information are stored in the
 * `uploadedName` and `uploadedContent` properties of the object, and if the
 * instance implements the `.onFileChanged()` method, that method is called.
 */
export class UploadItem {

    /**
     * Construct an upload control/area, as described above.
     * 
     * @param {string} name - the key to use to identify this input control's
     *   content in the dialog's key-value mapping for all input controls
     */
    constructor ( name ) {
        this.name = name
        this.style = `
            width: 100%;
            height: 100px;
            border: 1px solid #aaaaaa;
            display: flex;
            justify-content: center;
            align-content: center;
            flex-direction: column;
            padding: 1em;
        `.replace( /\n/g, ' ' )
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'htmlpanel',
            html : `
                <div id='drop_${this.name}' style='${this.style}'></div>
                <div style='${this.style}'>
                    <p>Option 2:
                    <input type='file' id='choose_${this.name}' accept=".lurch"/></p>
                </div>
            `
        } ]
    }

    // internal use only for finding/manipulating HTML elements unique to this class
    zone () { return document.getElementById( `drop_${this.name}` ) }
    // internal use only for finding/manipulating HTML elements unique to this class
    resetZone () {
        this.zone().innerHTML = 'Option 1: Drag and drop a file here.'
        this.zone().style.removeProperty( 'background' )
    }
    // internal use only for finding/manipulating HTML elements unique to this class
    input () { return document.getElementById( `choose_${this.name}` ) }
    // internal use only for finding/manipulating HTML elements unique to this class
    resetInput () {
        this.input().value = null
    }

    // internal use only for storing a file the user uploaded, for later retrieval
    setFile ( file ) {
        return file.text().then( content => {
            this.uploadedName = file.name
            this.uploadedContent = content
            this.onFileChanged?.()
        } )
    }

    // internal use only; styles the HTML components and installs event handlers
    onShow () {
        const zone = this.zone()
        // Handle basic events for styling and preventing file opening
        zone.addEventListener( 'dragover', event => event.preventDefault() )
        zone.addEventListener( 'dragenter', _ =>
            zone.style.background = '#eeeeff' )
        zone.addEventListener( 'dragleave', _ =>
            zone.style.removeProperty( 'background' ) )
        // If the user drops a file, upload it into a local variable
        zone.addEventListener( 'drop', event => {
            event.preventDefault()
            const dropped = event.dataTransfer.items ?
                Array.from( event.dataTransfer.items )
                    .filter( item => item.kind == 'file' ) :
                Array.from( event.dataTransfer.files )
            if ( dropped.length > 0 ) {
                this.setFile( dropped[0].getAsFile() ).then( () => {
                    zone.innerHTML = 'File uploaded.'
                    this.resetInput()
                } )
            }
        } )
        this.resetZone()
        const input = this.input()
        // If the user chooses a file, store it in a local variable
        input.addEventListener( 'change', () => {
            if ( input.files.length > 0 ) {
                this.setFile( input.files[0] ).then( () => {
                    this.resetZone()
                } )
            }
        } )
        this.resetInput()
    }

    // internal use only; returns a filename-and-content object if requested by
    // the dialog's get() function
    get ( key ) {
        if ( key == this.name ) return {
            filename : `file:///${ this.uploadedName }`,
            content : this.uploadedContent,
            source : 'upload'
        }
    }

}
