
/**
 * A set of generic utility functions used in this project.
 * 
 * @module Utilities
 */

/**
 * Create a script element to load a script from the given URL, append that
 * script element to the page's head, and notify us (via a returned `Promise`)
 * when the script completes loading successfully or fails with an error.
 * 
 * Example use:
 * ```
 * loadScript( 'https://some.cdn.org/script.js' ).then( () => {
 *     // Run code that depends on the script having loaded.
 * } )
 * ```
 * 
 * Note that if this function has already been called on this URL, so that there
 * already is a script tag with this source, then the promise resolves
 * immediately without doing anything first.
 * 
 * @param {String} url - URL of the script to load
 * @returns {Promise} a promise that is resolved if the script finishes loading
 *   or rejected if the script encounters an error
 * @function
 */
export const loadScript = url =>
    Array.from( document.head.querySelectorAll( 'script' ) ).some(
        script => script.getAttribute( 'src' ) == url ) ?
    Promise.resolve() :
    new Promise( ( resolve, reject ) => {
        const scriptTag = document.createElement( 'script' )
        document.head.append( scriptTag )
        scriptTag.setAttribute( 'defer', true )
        scriptTag.setAttribute( 'referrerpolicy', 'origin' )
        scriptTag.addEventListener( 'load', resolve )
        scriptTag.addEventListener( 'error', reject )
        scriptTag.setAttribute( 'src', url )
    } )

/**
 * From any JavaScript object, we can create another object by first
 * constructing a new instance of the Object prototype, then copying over all of
 * the "own" properties from the original object (by reference).  This is like
 * the original object, but without its prototype or any other inherited data or
 * methods.  This function does that.
 * 
 * @param {Object} object - any JavaScript object
 * @returns {Object} a shallow copy of the original object, but without copying
 *   its prototype information
 * @function
 */
export const copyWithoutPrototype = object => {
    const result = new Object()
    for ( let key in object )
        if ( object.hasOwnProperty( key ) )
            result[key] = object[key]
    return result
}

/**
 * Return the URL for this app.  It is taken directly from the browser's
 * navigation bar, but it excludes any query string that may be present.
 * It will be of the form `protocol://domain.name/path/to/file.html`.
 *
 * @function
 * @see {@link module:ImportFromURL.autoOpenLink autoOpenLink()}
 */
export const appURL = () => {
    const result = window.location.protocol + '//'
                 + window.location.host + window.location.pathname
    return result.endsWith( '/' ) ? result : result + '/'
}

/**
 * Escape a string so that it can be safely inserted into an HTML document and
 * still represent the plain text within the given string (not interpreting the
 * string as HTML itself).  For example, the string `"x < a and a > b"` should
 * appear exactly that way in the rendered HTML, meaning that the `<` and `>`
 * will need to be escaped so that `"<a and a>"` does not appear to be a tag.
 * 
 * @param {string} text - text to escape for insertion into HTML
 * @returns {string} the same text, but with the characters `"&"`, `"<"`, `">"`,
 *   `"'"`, and `'"'` replaced with character references instead
 */
export const escapeHTML = text =>
    text.replaceAll( '&', '&amp;' )
        .replaceAll( '<', '&lt;' )
        .replaceAll( '>', '&gt;' )
        .replaceAll( '"', '&quot;' )
        .replaceAll( "'", '&#039;' )

/**
 * Given an ordered set of HTML Nodes in an array, and a node in the same
 * document, return just the subset of `nodes` that appear before `point`.
 * Because the given set of nodes are in order, this subset will always be an
 * initial segment of the given array.  It can be empty (if none precede `point`)
 * and it can be the whole array (if all preceded `point`).
 * 
 * While this could be done with a simple array filter, that could be slow on
 * larger arrays; this uses a binary search.  Furthermore, node comparisons are
 * a tedious process that uses an enum, so this function is simpler.
 * 
 * @param {Node[]} nodes - ordered array of Nodes to filter
 * @param {Node} point - the node that will determine which subset of `nodes`
 *   gets rerturned
 * @returns {Node[]} some initial segment of `nodes`, including precisely those
 *   that appear before `point`
 */
export const onlyBefore = ( nodes, point ) => {
    const lt = ( a, b ) => {
        const comparison = a.compareDocumentPosition( b )
        if ( ( comparison & Node.DOCUMENT_POSITION_PRECEDING )
          || ( comparison & Node.DOCUMENT_POSITION_CONTAINS ) )
            return true
        if ( ( comparison & Node.DOCUMENT_POSITION_FOLLOWING )
          || ( comparison & Node.DOCUMENT_POSITION_CONTAINED_BY )
          || ( comparison == 0 ) ) // 0 means a == b
            return false
        throw new Error( 'Cannot compare document positions' )
    }
    try {
        if ( !lt( nodes[0], point ) ) return [ ]
        if ( lt( nodes[nodes.length-1], point ) ) return nodes
        let indexLT = 0
        let indexGE = nodes.length - 1
        while ( indexLT < indexGE - 1 ) {
            const midIndex = Math.floor( ( indexLT + indexGE ) / 2 )
            if ( lt( nodes[midIndex], point ) ) indexLT = midIndex
            else indexGE = midIndex
        }
        return nodes.slice( 0, indexGE )
    } catch ( e ) {
        console.log( 'DEBUG:', e )
        return nodes
    }
}
