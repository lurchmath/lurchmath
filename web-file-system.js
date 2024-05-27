
import { FileSystem } from './file-system.js'
import { Dialog, TextInputItem, ListItem, HTMLItem } from './dialog.js'
import { loadFromURL } from './load-from-url.js'
import { LurchDocument } from './lurch-document.js'
import { isValidURL } from './utilities.js'

/**
 * A subclass of {@link FileSystem} that represents browsing and downloading
 * files from the web as a file system.  Because it is a read-only file system,
 * all features related to saving are not implemented.
 * 
 * In fact, only one method is supported, {@link WebSystem#open open()}, the
 * details of which are documented below.  Technically, we could also implement
 * {@link FileSystem#list list()} in some cases, but that functionality is
 * subsumed under {@link WebSystem#open open()} in this class.
 * 
 * Warning:  CORS policies on most websites severely restrict the ability of a
 * website to load content from another website.  So providing a URL that lets a
 * student load a Lurch document from the web is very hard to do unless you
 * control the website that's hosting the file and you can set the CORS policy
 * to permit the Lurch app to fetch your file.  An easier way to handle this is
 * to check out a copy of the Lurch repo onto your web server and host the app
 * yourself, so that when you provide URLs to your students, they are going to
 * the same website as the app, and thus no CORS policies come into play.
 */
export class WebFileSystem extends FileSystem {

    static subclassName = FileSystem.registerSubclass(
        'the web', WebFileSystem )
    
    // Internal use only; extract all <a> targets and texts from some HTML
    getLinksFrom ( html ) {
        const results = [ ]
        const findLink = /<[^>]*href\s*=\s*(['"][^'"]*['"])[^>]*>([^<]*)<\/a/g
        let match
        while ( match = findLink.exec( html ) )
            results.push( {
                url : match[1].substring( 1, match[1].length - 1 ),
                text : match[2].replace( /<[^>]*>/g, '' )
            } )
        return results
    }

    /**
     * See the documentation of the {@link FileSystem#open open()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a file system that
     * represents browsing and downloading files from the web.  It does so as
     * follows.
     * 
     *  - If the given `fileObject` has a `filename` property, we treat it as an
     *    URL and load data from it.
     *     - If we fail to load data from it, reject with an error.
     *     - If we get a Lurch document as response (as decided by {@link
     *       LurchDocument.isDocumentHTML isDocumentHTML()}), we update the file
     *       object to have those contents and resolve to it.
     *     - If we get anything else, treat it as HTML and extract all links
     *       from it (of the form `<a href="target">text</a>`).  If the list of
     *       such links is empty, reject with an error.
     *     - If it is nonempty, display it to the user for browsing as if this
     *       URL were a folder full of files.  Selecting one recurs on this same
     *       function with that new URL as the `fileObject`'s filename.
     *     - While the user is browsing a virtual folder of that type, show them
     *       a button that lets them bookmark that folder.  If they are browsing
     *       a bookmarked folder, show them a button to un-bookmark it.
     *  - If the given `fileObject` has a `path` property, throw an error.
     *  - If the user does not provide a `fileObject` parameter, or provides one
     *    with an empty filename, show them a text input into which they can
     *    type an URL, and if they do so, recur on this function with that URL
     *    as the `fileObject`'s filename.
     *  - While showing them a text input, below it also show them a list of all
     *    bookmarks, as links they can click to fill the URL bar with the
     *    bookmark and click OK to navigate to it.  Double-clicking takes this
     *    action immediately.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#open the abstract
     *   method of the parent class}
     */
    open ( fileObject ) {
        // Case 1: They specified an invalid file object by specifying a path
        if ( fileObject?.path )
            throw new Error( 'WebFileSystem does not support paths' )
        // Case 2: Empty filename, so show a dialog asking for a URL
        if ( !fileObject?.filename ) {
            return new Promise( ( resolve, reject ) => {
                const dialog = new Dialog( 'Browsing', this.editor )
                dialog.addItem( new TextInputItem( 'url', 'Enter URL to open' ) )
                dialog.addItem( new HTMLItem( `Or select one of the following bookmarks:` ) )
                dialog.addItem( new HTMLItem( '(Bookmarks not yet implemented.)' ) )
                dialog.show().then( userHitOK => {
                    if ( !userHitOK ) return resolve()
                    resolve( this.open( { filename : dialog.get( 'url' ) } ) )
                } ).catch( reject )
            } )
        }
        // Case 3: Filename given, so load its contents and see what they are
        return new Promise( ( resolve, reject ) => {
            loadFromURL( fileObject.filename ).then( response => {
                // If it's a Lurch document, we are done
                if ( LurchDocument.isDocumentHTML( response ) ) {
                    resolve( {
                        fileSystemName : this.getName(),
                        filename : fileObject.filename,
                        contents : response
                    } )
                    return
                }
                // If it's not, get all of its links and let the user pick one
                const links = this.getLinksFrom( response )
                const dialog = new Dialog( 'Browsing', this.editor )
                dialog.addItem( new TextInputItem( 'url', 'Enter URL to open' ) )
                dialog.addItem( new HTMLItem( `Or select one of the following,
                    loaded from <tt>${fileObject.filename}</tt>:` ) )
                const listItem = new ListItem( 'selectLink' )
                listItem.setSelectable( true )
                dialog.addItem( listItem )
                listItem.onShow = () => listItem.showList(
                    links.map( link => `${link.text} (<tt>${link.url}</tt>)` ),
                    links )
                listItem.selectionChanged = () =>
                    dialog.querySelector( 'input[type="text"]' ).value =
                        listItem.selectedItem.url
                dialog.show().then( userHitOK => {
                    if ( !userHitOK ) return resolve()
                    let url = dialog.get( 'url' )
                    if ( !isValidURL( url ) ) {
                        let path = fileObject.filename.split( '/' )
                        path.pop()
                        path = path.join( '/' ) + '/'
                        url = path + url
                    }
                    resolve( this.open( { filename : url } ) )
                } ).catch( reject )
            } ).catch( reject )
        } )
    }

}
