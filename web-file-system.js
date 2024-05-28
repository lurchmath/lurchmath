
import { FileSystem } from './file-system.js'
import {
    Dialog,
    TextInputItem, ListItem, HTMLItem, ButtonItem, LabeledGroup, AlertItem
} from './dialog.js'
import { loadFromURL } from './load-from-url.js'
import { LurchDocument } from './lurch-document.js'
import { isValidURL } from './utilities.js'
import { appSettings } from './settings-install.js'

// Internal use only; extract all <a> targets and texts from some HTML
const getLinksFrom = html => {
    const results = [ ]
    const findLink = /<[^>]*href\s*=\s*(['"][^'"]*['"])[^>]*>(.*?)<\/a/g
    let match
    while ( match = findLink.exec( html ) )
        results.push( {
            url : match[1].substring( 1, match[1].length - 1 ),
            text : match[2].replace( /<[^>]*>/g, ' ' )
        } )
    return results
}

// Internal use only; combine a URL and a relative path to a new URL
const makeAbsoluteURL = ( url, path ) => {
    // If the path given is actually a full URL, then ignore the other URL and
    // just use the path alone.
    if ( isValidURL( path ) )
        return path
    // If the path is absolute, we need to chop any path in the URL.
    if ( path.startsWith( '/' ) ) {
        // If we can find protocol://host/ in the URL, use that.
        const host = /^([^/]*)(:\/\/)?([^/]+)[/]/.exec( url )
        if ( host )
            return host[1] + host[2] + host[3] + path
        // If we can fine protocol://host in the URL, use that.
        if ( /^[^/]*:\/\/[^/]+$/.test( url ) )
            return url + path
        // Not sure what's going on; make a desperate attempt here.
        const parts = url.split( '/' )
        parts.pop()
        return parts.join( '/' ) + path
    }
    // The path is relative, so we need to add it to the end of the URL.
    // Easiest case: When the URL ends with a /.
    if ( url.endsWith( '/' ) )
        return url + path
    // Next easiest case: If the URL ends with "foo.bar" we assume that's a file
    // because of the extension, so we replace that with the path.
    const parts = url.split( '/' )
    if ( parts[parts.length-1].includes( '.' ) ) {
        parts[parts.length-1] = path
        return parts.join( '/' )
    }
    // Tricky case: We will guess that a URL ending in what doesn't seem to be
    // a file (no extension) is probably the URL for a folder, and will thus
    // just glue the path on with a slash in between.
    return url + '/' + path
}

// Internal use only; the key for the following two functions
const bookmarkKey = 'web-file-system-bookmarks'
// Internal use only; save bookmarks (a list of strings, URLs) to settings
const saveBookmarks = bookmarks =>
    appSettings.saveHiddenSetting( bookmarkKey, JSON.stringify( bookmarks ) )
// Internal use only; get bookmarks (as a list of strings, URLs) from settings
const loadBookmarks = () =>
    JSON.parse( appSettings.loadHiddenSetting( bookmarkKey ) || '[]' )

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
                dialog.json.size = 'medium'
                dialog.addItem( new TextInputItem( 'url', 'Enter URL to open' ) )
                const bookmarks = loadBookmarks()
                if ( bookmarks.length > 0 ) {
                    const listItem = new ListItem( 'bookmarks' )
                    listItem.setSelectable( true )
                    listItem.onShow = () =>
                        listItem.showList( bookmarks, bookmarks )
                    const getUrlField = () =>
                        dialog.querySelector( 'input[type="text"]' )
                    listItem.selectionChanged = () =>
                        getUrlField().value = listItem.selectedItem || ''
                    listItem.onDoubleClick = () => {
                        if ( !/^\s*$/.test( getUrlField().value ) )
                            dialog.json.onSubmit()
                    }
                    dialog.addItem( new LabeledGroup(
                        'Or click a bookmark:', listItem ) )
                }
                dialog.addItem( new AlertItem(
                    'warn',
                    `Many websites do not permit apps like Lurch to download
                    files from them.  If you get an error when downloading, it
                    may be caused by the permissions of the other website.`
                ) )
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
                const links = getLinksFrom( response )
                const dialog = new Dialog( 'Browsing', this.editor )
                dialog.json.size = 'medium'
                dialog.addItem( new HTMLItem(
                    `Viewing page: <tt>${fileObject.filename}</tt>` ) )
                dialog.addItem( new TextInputItem( 'url', 'Enter URL to open' ) )
                if ( links.length > 0 ) {
                    const listItem = new ListItem( 'selectLink' )
                    listItem.setSelectable( true )
                    dialog.addItem( new LabeledGroup(
                        'Or select one of the links just loaded:', listItem ) )
                    listItem.onShow = () => listItem.showList(
                        links.map( link => `${link.text} (<tt>${link.url}</tt>)` ),
                        links )
                    const getUrlField = () =>
                        dialog.querySelector( 'input[type="text"]' )
                    listItem.selectionChanged = () =>
                        getUrlField().value = listItem.selectedItem?.url || ''
                    listItem.onDoubleClick = () => {
                        if ( !/^\s*$/.test( getUrlField().value ) )
                            dialog.json.onSubmit()
                    }
                    const bookmarks = loadBookmarks()
                    if ( bookmarks.includes( fileObject.filename ) ) {
                        dialog.addItem( new ButtonItem(
                            'Un-bookmark this page',
                            () => {
                                // Remove the bookmark
                                const index = bookmarks.indexOf(
                                    fileObject.filename )
                                bookmarks.splice( index, 1 )
                                saveBookmarks( bookmarks )
                                dialog.close()
                                // Reload the dialog so it's up-to-date
                                resolve( this.open( fileObject ) )
                            }
                        ) )
                    } else {
                        dialog.addItem( new ButtonItem(
                            'Bookmark this page',
                            () => {
                                // Add the bookmark
                                bookmarks.push( fileObject.filename )
                                saveBookmarks( bookmarks )
                                dialog.close()
                                // Reload the dialog so it's up-to-date
                                resolve( this.open( fileObject ) )
                            }
                        ) )
                    }
                } else {
                    dialog.addItem( new HTMLItem(
                        'No links were found at the requested web site.' ) )
                }
                dialog.show().then( userHitOK => {
                    if ( !userHitOK ) return resolve()
                    resolve( this.open( {
                        filename : makeAbsoluteURL(
                            fileObject.filename, dialog.get( 'url' ) )
                    } ) )
                } ).catch( reject )
            } ).catch( reject )
        } )
    }

}
