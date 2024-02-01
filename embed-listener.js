
/**
 * This module provides an `install()` function for use in the editor's setup
 * routine.  It takes action if and only if we detect that this instance of the
 * Lurch application is embedded in an iframe, and is thus not a top-level app
 * intended for users to edit, but an app that is being used in some other
 * context (e.g., documentation, blog, online book, etc.) where the author of
 * that site will be providing the application's document content, probably as
 * an example for the reader to view (and optionally edit).  See the
 * documentation below for the {@link module:EmbedListener.install install()}
 * function to learn more about its behavior.
 * 
 * To make it easy for users to embed Lurch documents in an external page, we
 * provide some handy notation, so that they do not need to write the intricate
 * HTML content that is the actual representation of atoms and shells in the
 * TinyMCE editor when Lurch is running.  (That would be far too complex for a
 * human author.)  Instead, they can use one of the following two notations.
 * 
 * **HTML Notation:**
 * 
 * Ordinary HTML, plus the following extra tags:
 * 
 *  - `<lurch>...</lurch>`, which should contain a single piece of text in Lurch
 *    notation, and will be replaced with an {@link Expression} atom that
 *    contains that notation (in advanced mode).
 *  - `<latex>...</latex>`, which should contain a single piece of LaTeX code,
 *    and will be replaced with an {@link ExpositoryMath} atom containing the
 *    same LaTeX code.
 *  - `<theorem>...</theorem>`, `<proof>...</proof>`, and so on, one for every
 *    type of {@link Shell} subclass that has been registered with the app, and
 *    which will be converted into a shell of that subclass, containing whatever
 *    is placed inside of the opening and closing tags.
 * 
 * **Markdown Notation:**
 * 
 * Ordinary Markdown, plus the following extra features:
 * 
 *  - Any text containing `$...$` will be replaced with a `<latex>...</latex>`
 *    tag containing the same content, and then processed as in HTML mode, as
 *    defined above.
 *  - Any inline code block encosed in backticks will be replaced with a
 *    `<lurch>...</lurch>` tag containing the same code, which should therefore
 *    be in Lurch notation, and will then be processed as in HTML mode, as
 *    defined above.
 *  - Any blockquote section (each line beginning with `>`) will be replaced
 *    by a `<proof>...</proof>` tag containing the contents of the blockquote,
 *    or a `<subproof>...</subproof>` tag instead if it is an inner blockquote
 *    (that is, one with a blockquote ancestor).
 * 
 * To make it easy for the outer page to define where copies of the Lurch app
 * should appear, and what they should contain, we provide a script you can
 * import into that outer page, which will do the job automatically.  See
 * {@link module:EmbedScript the embedded.js script} for details.
 * 
 * @module EmbedListener
 */

import { Atom } from './atoms.js'
import { loadScript, unescapeHTML, isEmbedded } from './utilities.js'
import { LurchDocument } from './lurch-document.js'

// Internal use only.
// Replace an HTML element <foo>...</foo> with <newTag>...</newTag>, but the
// same children.  Attributes are not currently copied over.  If that feature
// becomes important later, it could be added to this function.
const changeTag = ( element, newTag ) => {
    const newElement = document.createElement( newTag )
    while ( element.firstChild ) newElement.appendChild( element.firstChild )
    element.replaceWith( newElement )
}

// Internal use only.
// Does the given element have an ancestor whose tagName is the given one?
const hasTagAncestor = ( element, tag ) => {
    while ( element ) {
        if ( element.tagName == tag ) return true
        element = element.parentElement
    }
    return false
}

// Internal use only.
// Return a promise that resolves to a function that can convert the Markdown
// format documented at the top of this file to the HTML format documented there
// as well.  Thus to support the Markdown format, we just run this function,
// then do what we would do for the HTML format.
const markdownConverter = () => loadScript(
    'https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js'
).then( () => {
    const converter = new showdown.Converter()
    return markdown => {
        const wrapper = document.createElement( 'div' )
        // replace $...$ with <latex>...</latex> to support $latex$
        markdown = markdown.replace( /\$([^$]+)\$/g, '<latex>$1</latex>' )
        wrapper.innerHTML = converter.makeHtml( markdown )
        // replace <code>...</code> with <lurch>...</lurch> to support `lurchNotation`
        Array.from( wrapper.querySelectorAll( 'code' ) ).forEach( codeElt =>
            changeTag( codeElt, 'lurch' ) )
        // replace <blockquote>...</blockquote> with <subproof>...</subproof> to support `lurchNotation`
        Array.from( wrapper.querySelectorAll( 'blockquote' ) ).forEach( quoteElt =>
            changeTag( quoteElt,
                hasTagAncestor( quoteElt, 'blockquote' ) ? 'subproof' : 'proof' ) )
        return wrapper.innerHTML
    }
} )

// Internal use only.
// To make it easy for users to enter content with extra spaces and newlines,
// which they typically don't want in the document shown in the embedded editor
// (e.g., no blank paragraph between a theorem and its proof), we make this
// function that deletes spaces that the user probably doesn't want in there.
const clearSpaces = tree => {
    if ( tree.firstChild?.nodeType == 3 && tree.firstChild.textContent.trim() == '' )
        tree.removeChild( tree.firstChild )
    if ( tree.lastChild?.nodeType == 3 && tree.lastChild.textContent.trim() == '' )
        tree.removeChild( tree.lastChild )
    tree.childNodes.forEach( child => clearSpaces( child ) )
}

// Internal use only
// Given HTML to show in the TinyMCE editor, convert it into a form that can be
// handed to a LurchDocument() instance and placed into the editor.
const makeLurchDocumentHTML = html => `
    <div id='metadata'></div>
    <div id='document'>${html}</div>
`

/**
 * This function should be called on the TinyMCE's editor during its setup
 * phase.  It takes the following actions, to ensure support for a containing
 * page to be able to send a document to this editor for it to load.
 * 
 *  - Send a message to the top-level window saying that it's ready to receive
 *    data from the containing page, to populate the editor with.
 *  - Install an event handler for messages from the top-level window that
 *    expects the document to be shown in the editor.  When that document comes,
 *    it will be decoded from HTML or Markdown form, which includes interpreting
 *    any of the handy codes inside that HTML or Markdown into their correct
 *    form for inclusion in the app, as documented below.
 *  - If the user requests that the document be validated after it is shown, we
 *    queue up a validation action as well.
 * 
 * @param {tinymce.editor} editor - the editor in which to embed any document
 *   passed to us by our containing page
 * @function
 */
const install = editor => {
    // if this is not an embedded version of the app, do nothing, because this
    // whole script is designed for embedded copies, not the top-level app
    if ( !isEmbedded() ) return
    // when the editor finishes setting up, tell the top window that we're ready
    // to receive whatever document we should be displaying
    editor.on( 'init', () => window.top.postMessage( 'ready-for-embed', '*' ) )
    // if we get a message of what document to show in this embedded copy of the
    // app, handle it here:
    window.addEventListener( 'message', event => {
        if ( !event.data.hasOwnProperty( 'lurch-embed' ) ) return
        // deserialize the div from the HTML that was sent to us
        const wrapper = document.createElement( 'div' )
        wrapper.innerHTML = event.data['lurch-embed']
        const div = wrapper.firstElementChild
        // ensure it's the right format
        const format = div.getAttribute( 'format' ) || 'markdown'
        if ( format == 'html' ) {
            // convert Lurch-specific elements, fill editor, and maybe validate
            Atom.unsimplifyDOM( div, editor )
            clearSpaces( div )
            // We do the following rather than a simple editor.setContent(),
            // because this triggers update events for all the newly added
            // atoms, which is crucial to do now, before validation, so that
            // those updates don't erase any validation results we might add.
            new LurchDocument( editor ).setDocument(
                makeLurchDocumentHTML( div.innerHTML ) )
            Array.from(
                editor.dom.doc.body.querySelectorAll( 'p > [data-mce-bogus="1"]' )
            ).forEach( bogus => bogus.parentNode.remove() )
            // If validation has been requested, we must queue it up to happen
            // after a nonzero delay, so that all newly inserted atoms have been
            // updated before then, otherwise their validation results will be
            // erased during that update.
            if ( div.hasAttribute( 'validate' ) )
                setTimeout( () => {
                    editor.ui.registry.getAll().menuItems.validate.onAction()
                }, 100 )
        } else if ( format == 'markdown' ) {
            markdownConverter().then( converter => {
                div.innerHTML = converter( unescapeHTML( div.innerHTML ) )
                Atom.unsimplifyDOM( div, editor )
                clearSpaces( div )
                // Same comment as above applies to the following statement:
                new LurchDocument( editor ).setDocument(
                    makeLurchDocumentHTML( div.innerHTML ) )
                Array.from(
                    editor.dom.doc.body.querySelectorAll( 'p > [data-mce-bogus="1"]' )
                ).forEach( bogus => bogus.parentNode.remove() )
                // Same comments as above apply to why we delay validation a bit:
                if ( div.hasAttribute( 'validate' ) )
                    setTimeout( () => {
                        editor.ui.registry.getAll().menuItems.validate.onAction()
                    }, 100 )
            } )
        } else {
            // unsupported format
            editor.setContent( `Unsupported format: ${format}` )
            return
        }
    }, false )
}

export default { install }
