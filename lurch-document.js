
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
    }

    /**
     * Clear out the contents of the editor given at construction time.  This
     * includes clearing out its content as well as any metdata, including
     * document settings and dependencies.
     * 
     * NOTE: So far only the clearing of the editor's content has been
     * implemented.  Later, when per-document settings and dependencies have
     * been designed, we will come back here and add those features, too.
     */
    newDocument () {
        this.editor.setContent( '' )
        // should also clear out its metadata,
        // but have not yet implemented that
    }

    /**
     * Load the given document into the editor given at construction time.  This
     * will replace what's visible in the UI with the visible portion of the
     * given document, and will also replace the invisible document settings and
     * dependencies with those of the given document.
     * 
     * @param {string} document - the document as it was retrieved from a
     *   filesystem, ready to be loaded into this editor
     * 
     * NOTE: So far only filling the editor's content has been implemented.
     * Later, when per-document settings and dependencies have been designed, we
     * will come back here and add those features, too.
     */
    setDocument ( document ) {
        this.editor.setContent( document )
        // should later distinguish document metadata from document content
        // but have not yet implemented that
    }
    
    /**
     * Return the document being edited by the editor that was given at
     * construction time.  This includes its visible content as well as its
     * metdata, which includes document settings and dependencies.
     * 
     * NOTE: So far only the editor's visible content is supported.  Later, when
     * per-document settings and dependencies have been designed, we will come
     * back here and add those features, too.
     */
    getDocument () {
        return this.editor.getContent()
        // should later include the metadata stored in the editor as well
        // but have not yet implemented that
    }

}
