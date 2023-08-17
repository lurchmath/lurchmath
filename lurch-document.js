
import { appURL } from './utilities.js'
import { Settings } from './settings.js'
import { documentSettingsMetadata } from './document-settings.js'
import { className, Atom } from './atoms.js'

/**
 * A Lurch document will have several parts, including at least the following.
 * 
 *  * The document content as the user sees it in the editor (HTML)
 *  * Any per-document settings stored in the document as metadata (JSON)
 *  * Information about dependencies on which the document depents (the form of
 *    which has not yet been decided)
 * 
 * When stored in a filesystem, the document must contain all three of these
 * parts, but when displayed in the editor, it should show only the first of
 * them, keeping the rest somewhere outside of the user's view.  And yet those
 * other parts will be editable by the user, through a UI not yet developed.
 * And so when the document is saved, the latest versions of all three parts of
 * the document must be saved, not just the part visible in the editor.
 * 
 * This class provides a clean API for moving documents between any filesystem
 * and the editor.  It is an ephemeral/disposable class, in the sense that you
 * will often create an instance just for use in one command, and then let it be
 * garbage collected.  Examples:
 * 
 * ```js
 * // Clear out the editor, as in response to File > New:
 * new LurchDocument( editor ).newDocument()
 * // Get the document from the editor, in a form ready to save
 * // (that is, including all of its parts, not just what's visible in the UI):
 * const doc = new LurchDocument( editor ).getDocument()
 * // Load into the editor a document retrieved from a filesystem, which will
 * // have all 3 parts described above, only one of which should be shown:
 * new LurchDocument( editor ).setDocument( doc )
 * ```
 */
export class LurchDocument {

    /**
     * Construct a new instance for reading and/or writing data and metadata
     * to and/or from the given editor.
     * 
     * @param {tinymce.editor} editor the editor with which this object will
     *   interface
     */
    constructor ( editor ) {
        this.editor = editor
        if ( !this.editor.lurchMetadata ) this.clearMetadata()
    }

    // Internal use only.  Clears out the editor's content.
    clearDocument () {
        this.editor.setContent( '' )
    }
    // Internal use only.  Sets up empty/new metadata structure.
    clearMetadata () {
        this.editor.lurchMetadata = this.editor.dom.doc.createElement( 'div' )
        this.editor.lurchMetadata.setAttribute( 'id', 'metadata' )
        this.editor.lurchMetadata.style.display = 'none'
    }

    /**
     * Clear out the contents of the editor given at construction time.  This
     * includes clearing out its content as well as any metdata, including
     * document settings and dependencies.
     */
    newDocument () {
        this.clearDocument()
        this.clearMetadata()
        this.editor.undoManager.clear()
    }

    /**
     * A Lurch document has two main parts, a DIV storing the metadata followed
     * by a DIV storing the actual document content.  This function takes a
     * string containing the HTML for a Lurch document and extracts those two
     * components from it, returning each one as a fully constructed
     * `HTMLDivElement`.
     * 
     * Note that a Lurch document's HTML text also begins with a brief script to
     * create the link to open the document in the Lurch app, but that portion
     * of the input string is ignored, because it is not part of the document,
     * nor its metadata.
     * 
     * @param {string} document - the document as it was retrieved from a
     *   filesystem, ready to be loaded into this editor
     * @returns {Object} an object with `"metadata"` and `"document"` fields, as
     *   documented above
     */
    static documentParts ( document ) {
        const temp = window.document.createElement( 'div' )
        temp.innerHTML = document
        return {
            metadata : temp.querySelector( '#metadata' ),
            document : temp.querySelector( '#document' )
        }
    }

    /**
     * Load the given document into the editor given at construction time.  This
     * will replace what's visible in the UI with the visible portion of the
     * given document, and will also replace the invisible document settings and
     * dependencies with those of the given document.
     * 
     * @param {string} document - the document as it was retrieved from a
     *   filesystem, ready to be loaded into this editor
     */
    setDocument ( document ) {
        const parts = LurchDocument.documentParts( document )
        // There should be a metadata element; use it directly if so.
        if ( parts.metadata )
            this.editor.lurchMetadata = parts.metadata
        else
            this.clearMetadata()
        // There should be a document element; use its HTML content if so.
        if ( parts.document )
            this.editor.setContent( parts.document.innerHTML )
        else
            this.clearDocument()
        this.editor.undoManager.clear()
    }
    
    /**
     * Return the document being edited by the editor that was given at
     * construction time.  This includes its visible content as well as its
     * metdata, which includes document settings and dependencies.
     * 
     * @returns {string} the document in string form, ready to be stored in a
     *   filesystem
     */
    getDocument () {
        // Get the metadata and document as HTML strings
        const metadataHTML = this.editor.lurchMetadata.outerHTML
        const documentHTML = this.editor.getContent()
        // Use those to build the result
        return `
            <div id="loadlink">
                <p><a>Open this file in the Lurch web app</a></p>
                <script language="javascript">
                    const link = document.querySelector( '#loadlink > p > a' )
                    const thisURL = encodeURIComponent( window.location.href )
                    link?.setAttribute( 'href', '${appURL()}?load=' + thisURL )
                </script>
            </div>
            ${metadataHTML}
            <div id="document">${documentHTML}</div>
        `
    }

    // Internal use only.  Gets all HTML elements that store metadata.
    metadataElements () {
        return Array.from( this.editor.lurchMetadata.childNodes )
            .filter( element => element.tagName == 'DIV' )
    }
    // Internal use only.  Gets metadata element for a given key, if any.
    findMetadataElement ( category, key ) {
        return this.metadataElements().find( element =>
            element.dataset.category == category
         && element.dataset.key == key )
    }

    /**
     * Store a new piece of metadata in this object, or update an old one.
     * Pieces of metadata are indexed by a category-key pair, facilitating
     * "namespaces" within the metadata.  This is useful so that we can
     * partition the metadata into things like document-level settings, the
     * document's list of dependencies, data cached by algorithms in the app,
     * and any other categories that arise.
     * 
     * Values can be either JSON data (which includes strings, integers, and
     * booleans, in addition to the more complex types of JSON data) or HTML
     * in string form (for example, if you wish to store an entire dependency).
     * 
     * @param {string} category - the category for this piece of metadata
     * @param {string} key - the key for this piece of metadata
     * @param {string} valueType - either "json" or "html" to specify the format
     *   for the value
     * @param {string|Object} value - a string of HTML if `valueType` is "html"
     *   or an object we can pass to `JSON.stringify()` if `valueType` is "json"
     */
    setMetadata ( category, key, valueType, value ) {
        if ( ![ 'json', 'html' ].includes( valueType.toLowerCase() ) )
            throw new Error( 'Invalid setting value type: ' + valueType )
        const element = this.findMetadataElement( category, key )
        if ( element ) {
            element.dataset['valueType'] = valueType
            element.innerHTML = valueType == 'json' ? JSON.stringify( value ) : value
        } else {
            const newElement = this.editor.dom.doc.createElement( 'div' )
            newElement.dataset['category'] = category
            newElement.dataset['key'] = key
            newElement.dataset['valueType'] = valueType
            newElement.innerHTML = valueType == 'json' ? JSON.stringify( value ) : value
            this.editor.lurchMetadata.appendChild( newElement )
        }
    }

    /**
     * Pieces of metadata are indexed by a category-key pair, facilitating
     * "namespaces" within the metadata.  See {@link LurchDocument#setMetadata
     * setMetadata()} for more information on why.  This function looks up the
     * value that corresponds to the given category and key.
     * 
     * If the value is stored in JSON form, then the corresponding object will
     * be returned (as produced by `JSON.parse()`).  If the value is stored in
     * HTML form, then an `HTMLDivElement` instance will be returned, the
     * contents of which are the value of the metadata item.  The element
     * returned is a copy of the one stored internally, so the caller cannot
     * alter the internal value by modifying the returned element.
     * 
     * @param {string} category - the category for the piece of metadata to look
     *   up
     * @param {string} key - the key for the piece of metadata to look up
     * @returns {string|number|bool|Object|HTMLDivElement|undefined} the value
     *   stored in the metadata, or undefined if there is no such metadata
     */
    getMetadata ( category, key ) {
        const element = this.findMetadataElement( category, key )
        return !element ? undefined :
               element.dataset.valueType == 'html' ? element.cloneNode( true ) :
               JSON.parse( element.innerHTML )
    }
    
    /**
     * Pieces of metadata are indexed by a category-key pair, facilitating
     * "namespaces" within the metadata.  See {@link LurchDocument#setMetadata
     * setMetadata()} for more information on why.  This function returns all
     * categories that appear in the document's metadata.  There is no defined
     * order to the result, but no category is repeated.  The list may be empty
     * if this document has no metadata stored in it.
     * 
     * @returns {string[]} an array containing all strings that appear as
     *   categories in this document's metadata
     */
    getMetadataCategories () {
        const result = [ ]
        this.metadataElements().forEach( element => {
            if ( !result.includes( element.dataset.category ) )
                result.push( element.dataset.category )
        } )
        return result
    }

    /**
     * Pieces of metadata are indexed by a category-key pair, facilitating
     * "namespaces" within the metadata.  See {@link LurchDocument#setMetadata
     * setMetadata()} for more information on why.  This function returns all
     * keys that appear in the document's metadata under a given category.
     * There is no defined order to the result, but no key is repeated.  The
     * list may be empty if this document has no metadata stored in it under the
     * given category.
     * 
     * @param {string} category - the category whose keys should be listed
     * @returns {string[]} the keys corresponding to the given category
     */
    getMetadataKeys ( category ) {
        const result = [ ]
        this.metadataElements().forEach( element => {
            if ( element.dataset.category == category
              && !result.includes( element.dataset.key ) )
                result.push( element.dataset.key )
        } )
        return result
    }

    /**
     * Pieces of metadata are indexed by a category-key pair, facilitating
     * "namespaces" within the metadata.  See {@link LurchDocument#setMetadata
     * setMetadata()} for more information on why.  This function deletes the
     * unique metadata item stored under the given category-key pair if there is
     * one, and does nothing otherwise.
     * 
     * @param {string} category - the category for the piece of metadata to
     *   delete
     * @param {string} key - the key for the piece of metadata to delete
     */
    deleteMetadata ( category, key ) {
        const element = this.findMetadataElement( category, key )
        if ( element ) element.remove()
    }

    /**
     * Pop up a user interface allowing the user to edit the document's
     * settings.  Populate that user interface with the existing values of the
     * settings stored in the document's metadata, and if the user accepts any
     * changes they've made to the settings before closing the dialog, save
     * those changes back into the document's metadata as well.
     */
    showSettingsInterface () {
        // Create settings instance
        const settings = new Settings( 'Document settings',
            documentSettingsMetadata )
        // Load document settings into it
        const allowedKeys = settings.keys()
        this.getMetadataKeys( 'settings' ).forEach( key => {
            if ( allowedKeys.includes( key ) ) {
                const metadata = settings.metadata.metadataFor( key )
                const loaded = this.getMetadata( 'settings', key )
                settings.set( key,
                    metadata ? metadata.convert( loaded ) : loaded )
            }
        } )
        // Present interface to user
        settings.userEdit( this.editor )
        // Save iff the user accepted the changes
        .then( changedKeys => changedKeys.forEach( key =>
            this.setMetadata( 'settings', key, 'json', settings.get( key ) ) ) )
    }

    /**
     * For details of what an atom is, read the documentation of
     * {@link the Atom class}.  An editor can have any number of atoms in it,
     * each of which is represented as some HTML indicating that it is an atom,
     * but which is more convenient to work with in JavaScript through use of
     * the {@link Atom} class.
     * 
     * This function finds all atoms in the editor's HTML content, converts each
     * to an instance of the {@link Atom} class, and returns the resulting
     * array.
     * 
     * @returns {Atom[]} an array of all the atoms in the editor, each one
     *   represented as an instance of the {@link Atom} class
     */
    atoms () {
        return Array.from(
            this.editor.getDoc().getElementsByClassName( className )
        ).filter( element =>
            !element.parentNode.classList.contains( 'mce-offscreen-selection' )
        ).map( element => new Atom( element, this.editor ) )
    }

}
