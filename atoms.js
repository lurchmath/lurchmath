
/**
 * In a Lurch document, certain sections will be marked as "atoms."  These may
 * be an inline section represented by an HTML span or a block section
 * represented by an HTML div.  Atoms have the following properties.
 * 
 *  1. The user cannot *directly* edit their content.  Rather, the application
 *     determines how the atom appears in the document.
 *  2. The user can *indirectly* edit the atom's content by clicking on it and
 *     interacting with whatever dialog the application pops up in response.
 *  3. There can be many different types of atoms.  For example, one atom may be
 *     a mathematical equation while another atom adds an attribute to the
 *     document that contains it; these are two different types, and there will
 *     be other types as well.  The type is stored as an attribute of the atom's
 *     HTML element.
 *  4. Each atom will typically have some meaning that will be important when
 *     the document is processed in a mathematical way.
 * 
 * Atoms are represented in the document by spans and divs with a certain class
 * attached to mark them as atoms, and they are also have their
 * `contenteditable` property set to false, which TinyMCE respects so that the
 * user cannot edit their content (though they can cut, copy, paste, or delete
 * them).
 * 
 * This module contains tools for working with atoms, including the
 * {@link module:Atoms.className class name} we use to distinguish them, the
 * {@link module:Atoms.installMouseHandlers function} we use to install their
 * mouse event handlers, and most importantly, the
 * {@link module:Atoms.Atom class} we use to create an API for working with
 * individual atoms.
 *
 * @module Atoms
 */

/**
 * Class name used to distinguish HTML elements representing atoms.  (For an
 * explanation of what an atom is, see the documentation for
 * {@link module:Atoms the module itself}.)
 */
export const className = 'lurch-atom'

// Internal use only: simplify consistent use of class and attribute names
const metadataKey = key => `metadata_${key}`
const isMetadataKey = key => key.startsWith( 'metadata_' )
const innerMetadataKey = key => key.substring( 9 )
const childClass = type => `${className}-${type}`
const childSelector = type => '.' + childClass( type )

/**
 * For information about the concept of atoms in Lurch in general, see the
 * document of {@link module:Atoms the Atoms module}.  Because atoms are HTML
 * elements, their API is that provided by the browser for all HTML elements,
 * and is not specific to their role as atoms.  To provide an API that makes it
 * easier to deal with atoms in a Lurch document, we create this class.
 * 
 * One simply constructs an instance of this class, passing the corresponding
 * HTML element from within the editor, along with the editor itself, and the
 * resulting object provides an extensive API (documented below) for interfacing
 * with the atom in a variety of ways useful for the Lurch app.
 */
export class Atom {

    // Internal use only: Stores a mapping from atom types to event handlers for
    // atoms of that type.  Public use of this data should be done through the
    // addType() function below; clients do not need to read this data.
    static handlers = new Map()

    /**
     * This class will watch for click events on atoms in the editor, and will
     * call appropriate event handlers based on the type of atom that was
     * clicked.  To register a click event handler, call this function.  The
     * handler will be called with one parameter, the Atom instance that was
     * clicked.
     * 
     * @param {string} type - the type of atom for which to register an event
     *   handler
     * @param {function} handler the event handler being registered
     */
    static addType ( type, handler ) { Atom.handlers.set( type, handler ) }

    /**
     * Construct a new instance of this class corresponding to the atom
     * represented by the given `HTMLElement`.  Recall that the purpose of this
     * class, as documented above, is to provide an API for consistent and
     * convenient use of atoms, an API that is not part of the `HTMLElement`
     * API.  Thus to use that API, you use this constructor and then call
     * functions on the resulting object.  The intent is for such instances to
     * be ephemeral, in the sense that you can create one, use it, and let it be
     * garbage collected immediately thereafter, with little performance cost.
     * 
     * @param {HTMLElement} element - the element in the editor (a span or div)
     *   representing the atom
     * @param {tinymce.Editor} editor - the editor in which the element sits
     */
    constructor ( element, editor ) {
        if ( !Atom.isAtomElement( element ) )
            throw new Error( 'This is not an atom element: ' + element )
        this.element = element
        this.editor = editor
    }

    /**
     * Get the HTML representation of this atom, as it currently sits in the
     * document.
     * 
     * @returns {string} the HTML representation of this atom
     */
    getHTML () { return this.element.outerHTML }

    /**
     * An atom has the following three or four internal parts, called children.
     * If the atom is inline (a span) then each of the children is represented
     * as an inner span, but if the atom is a block (a div) then each of the
     * children is an inner div.
     * 
     *  1. The "metadata" child, which exists only in block-type atoms, and can
     *     contain arbitrarily large HTML metadata, none of which is displayed
     *     in the document for the user to see.  Clients should not read from or
     *     write to this HTML metadata storage directly, but should instead use
     *     the functions in this class designed for that purpose, including
     *     {@link module:Atoms.Atom#getHTMLMetadata getHTMLMetadata()} and
     *     {@link module:Atoms.Atom#setHTMLMetadata setHTMLMetadata()}.  The
     *     reason that this exists only in block-type atoms is because one
     *     cannot put arbitrary HTML inside a span, as one can with a div.
     *  2. The "prefix" child, which is the first child that is visible to the
     *     user in the document.  This may be omitted or empty, but in those
     *     situations where the atom should have some decoration on its left
     *     side (for inline atoms) or its top (for block atoms), such content
     *     can be placed in the prefix.  The client rarely needs to write to the
     *     prefix directly, but can instead use the
     *     {@link module:Atoms.Atom#fillChild fillChild()} function to do so.
     *     You can use this function to read from the prefix when needed.
     *  3. The "body" child, which is where the main content of the atom should
     *     go.  For example, if the atom represents a mathematical equation, the
     *     typeset version of that equation can go here.  Again, to specify the
     *     body content, use {@link module:Atoms.Atom#fillChild fillChild()}.
     *  4. The "suffix" child, which functions just like the prefix, except
     *     appears at the end (right side for inline atoms, bottom for block
     *     atoms).  Again, to specify the suffix content, use
     *     {@link module:Atoms.Atom#fillChild fillChild()}.
     * 
     * When you call this function, both parameters are optional.  If you do not
     * specify the type of child, it defaults to the body, and if the child you
     * request does not exist, it defaults to creating it for you.  (In a brand
     * new atom, there are no children; it is empty.)  If you do not wish the
     * child to be created, but rather receive `undefined` as the result if it
     * does not exist, set the second parameter to `false`.
     * 
     * @param {string} type - which type of child to fetch, must be one of
     *   `"metadata"`, `"prefix"`, `"body"`, or `"suffix"` (default is `"body"`)
     * @param {boolean} createIfNeeded - whether to create the child in question
     *   if it does not already exist (default is `true`)
     * @returns {HTMLElement} the child of the given type inside this atom
     */
    getChild ( type = 'body', createIfNeeded = true ) {
        // determine whether the type is valid and where it should be placed
        const sequence = [ 'metadata', 'prefix', 'body', 'suffix' ]
        const index = sequence.indexOf( type )
        if ( index == -1 ) // we also use this index further below
            throw new Error( 'Invalid child type: ' + type )
        if ( type == 'metadata' && this.element.tagName == 'SPAN' )
            throw new Error( 'Inline atoms cannot have a metadata child' )
        // return an existing child if there is one with the requested type
        const result = this.element.querySelector( childSelector( type ) )
        if ( result ) return result
        // if we are not allowed to create a new child, stop here
        if ( !createIfNeeded ) return undefined
        // create a new child of the given type
        const newChild = this.element.ownerDocument.createElement(
            this.element.tagName )
        newChild.classList.add( childClass( type ) )
        if ( type == 'metadata' ) newChild.style.display = 'none'
        // place it where it belongs in the sequence declared above
        for ( let i = index + 1 ; i < sequence.length ; i++ ) {
            const next = this.getChild( sequence[i], false )
            if ( next ) {
                this.element.insertBefore( newChild, next )
                break
            }
        }
        if ( newChild.parentNode != this.element )
            this.element.appendChild( newChild )
        // if TinyMCE added a random placeholder, that can now be removed
        Array.from( this.element.childNodes ).find( element =>
            element.tagName == 'BR' && element.dataset.mceBogus )?.remove()
        // return the newly created child
        return newChild
    }

    /**
     * Fill the child of the specified type with the given HTML content.  If the
     * child does not yet exist, create it before populating it.  See the
     * documentation for {@link module:Atoms.Atom#getChild getChild()} for an
     * explanation of the children of atoms.
     * 
     * @param {string} type - which type of child to write to; see the
     *   documentation for {@link module:Atoms.Atom#getChild getChild()} for a
     *   list of the valid children types
     * @param {string} html - the HTML code to use to fill the child
     */
    fillChild ( type, html ) { this.getChild( type ).innerHTML = html }

    /**
     * Remove the child with the specified type (or do nothing if there is no
     * such child).  See the documentation for {@link module:Atoms.Atom#getChild
     * getChild()} for an explanation of the children of atoms.
     * 
     * @param {string} type - which type of child to write to; see the
     *   documentation for {@link module:Atoms.Atom#getChild getChild()} for a
     *   list of the valid children types
     */
    removeChild ( type ) { this.getChild( type, false )?.remove() }

    /**
     * Look up a metadata entry in this atom using the given key.  Atoms can
     * contain metadata mapping any string key to any JSONable value.  Thus this
     * function will return a JSONable object, as extracted from the given key,
     * if that key indeed appears in this atom's metadata.
     * 
     * This type of metadata is stored in the `dataset` property of the
     * `HTMLElement` representing the atom.  This is a natural way to store
     * small amounts of data about the atom.  For larger amounts of data, you
     * may wish to use {@link module:Atoms.Atom#getHTMLMetadata
     * getHTMLMetadata()} instead.
     * 
     * @param {string} key - the key whose value should be looked up
     * @returns {any} the data associated with the given key, or undefined if
     *   the key is not in the metadata
     */
    getMetadata ( key ) {
        return JSON.parse( this.element.dataset[metadataKey( key )] )
    }

    /**
     * Store a metadata entry in this atom under the given key.  Atoms can
     * contain metadata mapping any string key to any JSONable value, so you
     * should provide a value that is amenable to JSON encoding.  It will be
     * stored using its JSON encoding, as a string.
     * 
     * @param {string} key - the key under which to store the value
     * @param {any} value - the value to store
     */
    setMetadata ( key, value ) {
        this.element.dataset[metadataKey( key )] = JSON.stringify( value )
    }

    /**
     * Look up the keys for all metadata entries stored in this atom.  Atoms can
     * contain metadata mapping any string key to any JSONable value.  This
     * function returns only the keys, as an array.
     * 
     * @returns {string[]} all keys under which metadata has been stored in this
     *   atom
     */
    getMetadataKeys () {
        return Object.keys( this.element.dataset )
            .filter( isMetadataKey ).map( innerMetadataKey )
    }

    // For internal use by the functions below
    metadataElements () {
        const metadataChild = this.getChild( 'metadata', false )
        return metadataChild ? Array.from( metadataChild.childNodes ).filter(
            element => element.tagName == 'DIV' ) : [ ]
    }
    // For internal use by the functions below
    findMetadataElement ( key ) {
        return this.metadataElements().find( element =>
            element.dataset.key == key )
    }

    /**
     * Look up an HTML metadata entry in this atom using the given key.  In
     * addition to the JSONable metadata that can be stored in any atom (as
     * documented in {@link module:Atoms.Atom#getMetadata getMetadata()}), you
     * can also store arbitrarily large amounts of HTML in block-type atoms (not
     * inline ones).  This is useful, for example, when storing an entire
     * dependency's HTML inside the atom that has imported it; the data can be
     * stored as DOM nodes rather than as a JSON-encoded HTML string.  This
     * makes it easier to use when doing computations that depend on the meaning
     * of the dependency's content.
     * 
     * This type of metadata is stored inside the `"metadata"` child of the
     * block-type atom, as documented {@link module:Atoms.Atom#getChild here}.
     * The return value for this function will be an `HTMLDivElement` that sits
     * inside that `"metadata"` child, and serves as a wrapper containing any
     * number of HTML elements (or any large amount of text).  While the return
     * value is a single element, it is a wrapper that should be ignored,
     * because its child node list is the actual value of the metadata that was
     * looked up.
     * 
     * @param {string} key - the key whose HTML should be looked up
     * @returns {HTMLDivElement} the element wrapping the corresponding value
     */
    getHTMLMetadata ( key ) { return this.findMetadataElement( key ) }

    /**
     * Store an HTML metadata entry in this atom under the given key.
     * Block-type atoms can contain metadata mapping any string key to any
     * amount of HTML content, as documented
     * {@link module:Atoms.Atom#getHTMLMetadata here}.  This function stores a
     * new entry in that metadata storage area.
     * 
     * Note that only block-type atoms can contain HTML metadata, and so calling
     * this function on an inline atom will throw an error.
     * 
     * Any HTML element passed as the value will not be used directly, but will
     * be copied (i.e., its HTML code will be written to the `.innerHTML`
     * property of the appropriate metadata element), in case the element in
     * question is not from the same document.  The value may instead be the
     * HTML code itself, as a string.
     * 
     * @param {string} key - the key under which to store the value
     * @param {HTMLElement|string} value - the value to store, either as an
     *   HTMLElement or a string
     */
    setHTMLMetadata ( key, value ) {
        if ( this.element.tagName != 'DIV' )
            throw new Error( 'Inline atoms cannot have HTML metadata' )
        const child = this.findMetadataElement( key )
        if ( child ) {
            child.innerHTML = value.innerHTML || value
        } else {
            const newDatum = this.element.ownerDocument.createElement( 'div' )
            newDatum.dataset.key = key
            newDatum.innerHTML = value.innerHTML || value
            this.getChild( 'metadata', true ).appendChild( newDatum )
        }
    }

    /**
     * Look up the keys for all HTML metadata entries stored in this atom.  For
     * information on the difference between basic atom metadata and HTML
     * metadata, see the documentation {@link module:Atoms.Atom#getHTMLMetadata
     * here}.
     * 
     * @returns {string[]} all keys under which HTML metadata has been stored in
     *   this atom
     */
    getHTMLMetadataKeys () {
        return this.metadataElements().map( element => element.dataset.key )
    }

    /**
     * One can construct an instance of the Atom class to interface with an
     * element in the editor only if that element actually represents an atom,
     * as defined in {@link module:Atoms the documentation for the Atoms
     * module}.  This function checks to see if the element in question does.
     * To create elements that do represent atoms, see
     * {@link module:Atoms.Atom.createElement createElement()}.
     * 
     * @param {HTMLElement} element - the element to check
     * @returns {boolean} whether the element represents an atom
     */
    static isAtomElement ( element ) {
        return ( element.tagName == 'DIV' || element.tagName == 'SPAN' )
            && element.classList.contains( className )
    }

    /**
     * When a mouse event takes place in the document, it is useful to be able
     * to check whether it happened inside an element representing an atom.  So
     * this function can take any DOM node and walk up its ancestor chain and
     * find whether any element in that chain represents an atom.  If so, it
     * returns the corresponding Atom instance.  If not, it returns null.
     * 
     * @param {Node} node - the DOM node from which to begin searching
     * @param {tinymce.Editor} editor - the editor in which the node sits
     * @returns {Atom?} the nearest Atom node enclosing the given `node`
     */
    static findAbove ( node, editor ) {
        for ( let walk = node ; walk ; walk = walk.parentNode )
            if ( Atom.isAtomElement( walk ) )
                return new Atom( walk, editor )
        return null
    }

    /**
     * Create an HTMLElement that can be placed into the given `editor` and that
     * represents an inline or block-type atom, as specified by the second
     * parameter.  The element will be given an HTML/CSS class that marks it as
     * representing an atom, and will be marked uneditable so that TinyMCE will
     * not allow the user to alter it directly.
     * 
     * @param {tinymce.Editor} editor - the TinyMCE editor in which to create
     *   the element
     * @param {string} tagName - the tag to use, `"span"` for inline atoms or
     *   `"div"` for block-type atoms (which is the default)
     * @returns {HTMLElement} the element constructed
     */
    static createElement ( editor, tagName = 'div' ) {
        if ( tagName.toLowerCase() != 'div' && tagName.toLowerCase() != 'span' )
            throw new Error( 'Invalid tag name for atom element: ' + tagName )
        const result = editor.dom.doc.createElement( tagName )
        result.classList.add( className )
        result.setAttribute( 'contenteditable', false )
        return result
    }

    /**
     * Create a new atom element, as in {@link module:Atoms.Atom.createElement
     * createElement()}, then fill its body with the given content, optionally
     * set one or more metadata key-value pairs, and return an Atom instance
     * corresponding to the new element.  Note that this does not insert the
     * element anywhere into the editor.
     * 
     * @param {tinymce.Editor} editor - the TinyMCE editor in which to create
     *   the element
     * @param {string} tagName - the tag to use, `"span"` for inline atoms or
     *   `"div"` for block-type atoms (which is the default)
     * @param {string} content - the HTML code to use for filling the body of
     *   the newly created atom
     * @param {Object} metadata - a dictionary of key-value pairs to store in
     *   the metadata of the newly created atom (defaults to the empty object
     *   `{ }`, meaning not to add any metadata)
     * @returns {Atom} the Atom instance corresponding to the newly created
     *   atom element
     */
    static create ( editor, tagName, content, metadata = { } ) {
        const result = new Atom( Atom.createElement( editor, tagName ), editor )
        result.fillChild( 'body', content )
        Object.keys( metadata ).forEach( key =>
            result.setMetadata( key, metadata[key] ) )
        return result
    }

    /**
     * A convenience function that calls {@link module:Atoms.Atom.create
     * create()} for you, but uses the tag `"span"` to make an inline element.
     * This makes the client's code more clear, because it specifies that we are
     * creating a new *inline* atom.
     * 
     * @param {tinymce.Editor} editor - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @param {string} content - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @param {Object} metadata - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @returns {Atom} same as in {@link module:Atoms.Atom.create create()}
     */
    static newInline ( editor, content, metadata = { } ) {
        return Atom.create( editor, 'span', content, metadata )
    }

    /**
     * A convenience function that calls {@link module:Atoms.Atom.create
     * create()} for you, but uses the tag `"div"` to make an inline element.
     * This makes the client's code more clear, because it specifies that we are
     * creating a new *block-type* atom.
     * 
     * @param {tinymce.Editor} editor - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @param {string} content - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @param {Object} metadata - same as in
     *   {@link module:Atoms.Atom.create create()}
     * @returns {Atom} same as in {@link module:Atoms.Atom.create create()}
     */
    static newBlock ( editor, content, metadata = { } ) {
        return Atom.create( editor, 'div', content, metadata )
    }

}

/**
 * This function should be called in the editor's setup routine.  It installs a
 * single mouse event handler into the editor that can watch for click events to
 * any atom, and route control flow to the event handler for that atom's type.
 * 
 * @param {tinymce.Editor} editor - the editor in which to install the event
 *   handlers
 * @function
 */
export const installMouseHandlers = editor => {
    editor.on( 'init', () => {
        editor.dom.doc.body.addEventListener( 'click', event => {
            const receiver = Atom.findAbove( event.target, editor )
            if ( receiver ) {
                const type = receiver.getMetadata( 'type' )
                if ( Atom.handlers.has( type ) )
                    Atom.handlers.get( type )( receiver )
                else
                    console.log( `No atom click handler installed for type "${type}"` )
            }
        } )
    } )
}