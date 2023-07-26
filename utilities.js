
/**
 * A set of generic utility functions used in this project.
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
 * @param {String} url - URL of the script to load
 * @returns {Promise} a promise that is resolved if the script finishes loading
 *   or rejected if the script encounters an error
 */
export const loadScript = url => new Promise( ( resolve, reject ) => {
    const scriptTag = document.createElement( 'script' )
    document.head.append( scriptTag )
    scriptTag.setAttribute( 'defer', true )
    scriptTag.setAttribute( 'referrerpolicy', 'origin' )
    scriptTag.addEventListener( 'load', resolve )
    scriptTag.addEventListener( 'error', reject )
    scriptTag.setAttribute( 'src', url )
} )
