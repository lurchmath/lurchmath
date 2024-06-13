
import { FileSystem } from './file-system.js'
import {
    Dialog, TextInputItem, ButtonItem, DialogRow, AlertItem
} from './dialog.js'
import { loadFromURL } from './load-from-url.js'
import { LurchDocument } from './lurch-document.js'
import { isValidURL, makeAbsoluteURL } from './utilities.js'
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
// Note that this is different from `makeAbsoluteURL` imported from utilities.js
// because this one does not assume the app URL is the base.
const joinUrlAndPath = ( url, path ) => {
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
     * Implement this abstract method from the base class, in this case so that
     * it downloads files from a given URL on the web.  As long as the given
     * file object's `filename` property is not `undefined`, this method will
     * try to use it as a valid URL and fetch the file at that URL.  If the
     * filename is a full URL, it will be used as-is, but if it is a relative
     * file path, it will be made absolute by considering the folder in which
     * sits the page that launched the app.
     * 
     * It is an error to call this method with a file object that specifies a
     * path.  The caller should put the entire URL into the filename field
     * instead.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} a promise that resolves to the file object that was
     *   passed in, with its `contents` property set to the contents of the
     *   downloaded file, or rejects with an error if the download fails
     * 
     * @see {@link module:Utilities.isValidURL isValidURL()}
     * @see {@link module:Utilities.appURL appURL()}
     * @see {@link module:Utilities.makeAbsoluteURL makeAbsoluteURL()}
     */
    read ( fileObject ) {
        if ( !fileObject?.filename )
            return Promise.reject( new Error( 'No filename given' ) )
        if ( fileObject.path )
            throw new Error( 'WebFileSystem does not support paths' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( !isValidURL( fileObject.filename ) )
            fileObject.filename = makeAbsoluteURL( fileObject.filename )
        return loadFromURL( fileObject.filename ).then( contents => {
            fileObject.contents = contents
            return fileObject
        } )
    }

    /**
     * Override the base class implementation to fit the needs of this class.
     * The parent class requires the file system to be able to list its files,
     * but a web-based file system cannot do so, because of course there are an
     * enormous number of web pages and this app cannot know them all.  So
     * instead, it provides a slightly different interpretation of the idea of
     * "listing" files.
     * 
     * If browsing the "root" of the web file system, the resulting list of
     * links is the set of bookmarks the user has saved.  If browsing a
     * different path, that path must be a URL from which a webpage will be
     * downloaded, and all links in that page treated as the contents of a
     * virtual "folder" at that path.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}, but
     *   with its path being either empty or a valid URL, as described above
     * @returns {Promise} a promise that resolves to an array of file objects,
     *   as documented in {@link FileSystem#list the documentation for this
     *   method in the parent class}
     */
    list ( fileObject ) {
        // If wrong filesystem, stop there
        if ( fileObject?.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        // Otherwise, just use the fileObject's path, or default to '' if empty:
        const pathToList = fileObject?.path || ''
        // The "root" of this virtual file system is the set of bookmarks
        if ( pathToList == '' )
            return Promise.resolve( loadBookmarks().map( url => { return {
                isBookmark : true,
                path : url
            } } ) )
        // Any other path is treated as "folder" in the sense that it is
        // downloaded and then all links (<a href="...">...</a>) in it are
        // treated as its contents
        const pageToItems = page => {
            return getLinksFrom( page ).map( link => { return {
                fileSystemName : this.getName(),
                path : link.url,
                icon : '',
                displayName : `${link.text} (${link.url})`
            } } )
        }
        // They may have pre-loaded the page for us; if so, we're done
        if ( fileObject.contents )
            return Promise.resolve( pageToItems( fileObject.contents ) )
        // Otherwise, download it, then proceed
        return this.read( {
            filename : fileObject.path
        } ).then( newFileObject => pageToItems( newFileObject.contents ) )
    }

    /**
     * Override the base class implementation to fit the needs of this class.
     * The parent class requires the file system to be able to list its files,
     * but a web-based file system cannot do so, because of course there are an
     * enormous number of web pages and this app cannot know them all.
     * Therefore, this file system needs a different UI than the one the parent
     * class provides.
     * 
     * Here, we provide three ways for a user to transfer a file from the web
     * into this app.  This function returns a collection of dialog items that 
     * provide such functionality, as follows.
     * 
     *  - One dialog item is a text box into which the user can type the URL of
     *    a file on the web.  A note appears beneath this blank pointing out
     *    that many websites on the Internet do not allow for cross-site file
     *    transfer, so beware that this has limited applicability.
     *  - If the user enters a file into that blank and chooses to fetch it, the
     *    app will do so, and if it finds that the result is a Lurch document,
     *    it will be opened in the app.  However, if it finds that the result is
     *    not a Lurch document, it will be treated as a collection of links to
     *    be shown to the user like a folder for browsing.  The user can click
     *    any such link to follow it and browse the resulting "folder," etc.
     *    This allows instructors to set up nested collections of Lurch
     *    documents, organized into folders, on a website, just by writing tiny
     *    web pages with links in them (or allowing the web server to
     *    auto-generate the folder lists as pages, which many servers do).
     *  - The second dialog item, below the first, is a list of bookmarks.  When
     *    a user is browsing any "folder" in the sense defined above, they can
     *    mark it as a bookmark to add it to this list.  Each bookmark will also
     *    have an "unbookmark this" button when visiting it.  This is so that a
     *    student user can visit the webpage for a course's Lurch documents,
     *    bookmark it, and never need to enter the URL again.  The instructor
     *    may even update the content throughout the semester, and the user will
     *    always have it bookmarked.
     * 
     * If the user chooses a document, when this function calls the
     * `selectFile()` method in the dialog, it will pass a file object with its
     * file contents loaded, and the caller will not need to fetch the data
     * itself.
     * 
     * @returns {Object[]} an array of dialog items representing the UI
     *   described above
     */
    fileChooserItems ( fileObject ) {
        // This is the same as its parent class, with one event handler changed,
        // and two new buttons added, so we fetch the same UI that the parent
        // class provides, then modify it.
        const parent = super.fileChooserItems( fileObject )
        const chooser = parent[0]
        const urlInput = new TextInputItem( 'url', undefined,
            'http://example.com/my-file.lurch' )
        const bookmarkButton = new ButtonItem( 'Add bookmark' )
        const unbookmarkButton = new ButtonItem( 'Remove bookmark' )
        const goButton = new ButtonItem( 'Go' )
        parent.unshift( new AlertItem( 'warn',
            `Not every website permits downloading its files into web apps.
            If you try to download a file and it fails, it may be due to the
            permissions of the website hosting the file.` ) )
        parent.unshift( new DialogRow( urlInput, goButton ) )
        parent.push( bookmarkButton )
        parent.push( unbookmarkButton )
        // Utility functions for dealing with the UI items defined above:
        const urlBlank = () =>
            urlInput.dialog.querySelector( 'input[type="text"]' )
        const chooserTarget = () =>
            joinUrlAndPath( chooser.path, chooser.get( chooser.name )?.path || '' )
        const selectFile = contents => {
            chooser.dialog.selectFile( {
                fileSystemName : this.getName(),
                filename : urlBlank().value,
                contents : contents
            } )
        }
        const showCorrectButtons = () => {
            const url = urlBlank().value
            const isBookmarked = url && loadBookmarks().includes( url )
            unbookmarkButton.getElement().style.display =
                isBookmarked ? 'inline' : 'none'
            bookmarkButton.getElement().style.display =
                url && !isBookmarked ? 'inline' : 'none'
        }
        const bookmarksChanged = () => {
            if ( chooser.path == '' ) chooser.repopulate()
            showCorrectButtons()
        }
        const goToUrl = () => {
            const url = urlBlank().value
            // If the user wants to go back to the bookmarks list, okay
            if ( url == '' ) {
                chooser.path = ''
                chooser.repopulate()
                return
            }
            // If it is not a valid URL, stop here
            if ( !isValidURL( url ) ) {
                Dialog.failure( this.editor,
                    `Not a valid web address: ${url}`,
                    'Invalid URL' )
                return
            }
            // We can't know how to proceed until we download the URL
            loadFromURL( url ).then( contents => {
                // If it was a Lurch document, mark it as a file and submit
                if ( LurchDocument.isDocumentHTML( contents ) ) {
                    selectFile( contents )
                    chooser.dialog.json.onSubmit()
                    return
                }
                // If it was not, let list() treat it as a folder
                chooser.path = url
                chooser.repopulate()
            } ).catch( error => {
                Dialog.failure( this.editor,
                    `Failed to download file from ${url}`,
                    'Could not download file' )
                console.error( error )
            } )
        }
        // Install that on the chooser's double-click and the go button's click
        chooser.onDoubleClick = goToUrl
        goButton.action = goToUrl
        // And here are the actions for the two buttons we added:
        unbookmarkButton.action = () => {
            saveBookmarks( loadBookmarks().filter( url => url != urlBlank().value ) )
            bookmarksChanged()
        }
        bookmarkButton.action = () => {
            saveBookmarks( [ ...loadBookmarks(), urlBlank().value ] )
            bookmarksChanged()
        }
        // Now make the buttons hide/show as needed:
        urlInput.onShow = () => {
            urlBlank().addEventListener( 'input', showCorrectButtons )
            urlBlank().parentNode.style.width = '100%' // also make it look nice
        }
        const originalSelectionChanged = chooser.onSelectionChanged
        chooser.onSelectionChanged = () => {
            originalSelectionChanged.apply( chooser )
            if ( chooser.selectedItem ) {
                const urlBlank = urlInput.dialog.querySelector( 'input[type="text"]' )
                urlBlank.value = chooserTarget()
            }
        }
        // And ensure the buttons sit in the footer of the dialog
        bookmarkButton.onShow = () => {
            const okButton = chooser.dialog.querySelector( 'button[title="OK"]' )
            okButton.parentNode.insertBefore( bookmarkButton.getElement(), okButton )
            okButton.parentNode.insertBefore( unbookmarkButton.getElement(), okButton )
            showCorrectButtons()
        }
        // Now return the parent class's UI, with those modifications:
        return parent
    }

    /**
     * Overriding the default implementation of {@link FileSystem#fileSaverItems
     * fileSaverItems()} to return an empty list, indicating that this subclass
     * does not provide a way to save files.
     */
    fileSaverItems ( _fileObject ) { return [ ] }

}
