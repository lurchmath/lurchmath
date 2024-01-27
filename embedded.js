
/**
 * The intent of this script is that any page on the web can import this script
 * and it will find all elements in the page of the form
 * `<div class='lurch-embed'>...</div>` and will transform each into an iframe
 * containing the Lurch app, then pass the HTML form of the div to that app as a
 * string using `postMessage()`.  The app is then free to load the content of
 * the div, as a document, and respect any attributes the user has attached to
 * that div, as part of that process.
 */

// Where the main app is stored, but this can be overridden by setting the
// corresponding value in the window object, or on a case-by-case basis in each
// div, using the appURL attribute.
const defaultAppURL = window.defaultAppURL
    || 'http://lurchmath.github.io/lurchmath/index.html'

// Convert a given div into an embedded instance of the Lurch app
const convertToEmbeddedLurch = div => {
    // Figure out which URL we are using for the embedded app in this case
    const appURL = div.getAttribute( 'appURL' ) || defaultAppURL
    // Create a new iframe containing the Lurch app, with all the div's attributes
    const iframe = document.createElement( 'iframe' )
    iframe.setAttribute( 'src', appURL )
    Array.from( div.attributes ).forEach( pair => {
        if ( pair.name != 'appURL' )
            iframe.setAttribute( pair.name, pair.value )
    } )
    // When that iframe finished loading the app, send the div's contents to it
    iframe.addEventListener( 'load',
        () => iframe.contentWindow.postMessage(
            { 'lurch-embed' : div.outerHTML }, new URL( appURL ).origin ) )
    // Put the iframe in the document in place of the div
    div.replaceWith( iframe )
}

// Run the above function on all relevant divs in the document
window.addEventListener( 'load', () => {
    Array.from( document.querySelectorAll( 'div.lurch-embed' ) ).forEach( div => {
        // Here we test if it's still in the document, in case someone illegally
        // embedded one Lurch embed inside another, and we removed it in a
        // previous iteration of this loop.
        if ( document.contains( div ) ) convertToEmbeddedLurch( div )
    } )
} )
