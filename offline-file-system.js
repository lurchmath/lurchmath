
import { FileSystem } from './file-system.js'
import { UploadItem, downloadFile } from './upload-download.js'
import { TextInputItem, ButtonItem } from './dialog.js'

/**
 * A subclass of {@link FileSystem} that represents the file system on the
 * user's computer, which Lurch access only indirectly, by allowing the user to
 * upload files from it or download files to it.
 * 
 * Because the browser cannot access the user's file system, the `path` member
 * of file objects is not used.  (In some methods below, if that member is
 * present and is a nonempty string, then the method will fail in the way
 * documented in that method.)  Also, UIDs are not used by this file system;
 * rather, filenames are used to identify files.  UIDs are ignored in all
 * methods of this class.
 * 
 * Note that there are three abstract methods of the parent class that this
 * class does not implement, because the browser has no access to the user's
 * computer, and thus cannot implement {@link FileSystem#delete delete()},
 * {@link FileSystem#has has()}, or {@link FileSystem#list list()}.
 */
export class OfflineFileSystem extends FileSystem {

    static subclassName = FileSystem.registerSubclass(
        'your computer', OfflineFileSystem )

    /**
     * Override the base class implementation to fit the needs of this class.
     * The parent class requires the file system to be able to list its files,
     * but the offline file system cannot do so, because JavaScript in the
     * browser has no access to the user's hard drive.  Therefore, this file
     * system needs a different UI than the one the parent class provides.
     * 
     * Here, we provide two ways for a user to upload a file from their own
     * files.  This function returns a single dialog item that packages those
     * two methods into one item.  The first method is a UI element that
     * invites the user to drag and drop files onto it to upload them.  The
     * second method is a button the user can click to open a dialog for
     * browsing their computer's files and choosing one to upload.
     * 
     * If the user takes either of those actions, when this function calls the
     * `selectFile()` method in the dialog, it will pass a file object with the
     * file's contents already loaded into it, because the dialog cannot be
     * expected to read from the user's computer on its own.
     * 
     * @returns {Object[]} an array of dialog items, in this case, just one
     */
    fileChooserItems () {
        const item = new UploadItem( 'uploadedFile', 'File to open' )
        const originalOnShow = item.onShow
        item.onShow = () => {
            item.dialog.selectFile() // none yet
            originalOnShow.apply( item )
        }
        item.onFileChanged = () => {
            const { filename, content } = item.dialog.get( 'uploadedFile' )
            item.dialog.selectFile( {
                fileSystemName : this.getName(),
                filename : filename,
                contents : content
            } )
        }
        return [ item ]
    }

    /**
     * Overriding the default implementation of {@link FileSystem#fileSaverItems
     * fileSaverItems()} to return a different UI than the default:  This one
     * contains a text blank into which the user can type the filename into
     * which they want to save the document, then click a button to download
     * the file using that filename.
     */
    fileSaverItems ( fileObject ) {
        const filenameBlank = new TextInputItem( `saveFilename`, 'Filename' )
        const filenameElement = () =>
            filenameBlank.dialog.querySelector( 'input[type="text"]' )
        filenameBlank.onShow = () =>
            filenameElement().value = fileObject?.filename ||
                filenameBlank.dialog.get( 'saveFilename' ) || ''
        const downloadButton = new ButtonItem( `${name}Download`, () => {
            const newFileObject = {
                fileSystemName : this.getName(),
                filename : filenameElement().value
            }
            downloadFile( this.editor, newFileObject.filename )
            this.documentSaved( newFileObject )
            filenameBlank.dialog.close()
        } )
        return [ filenameBlank, downloadButton ]
    }

   /**
     * See the documentation of the {@link FileSystem#write write()} method in
     * the parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a file system that
     * represents the user's own computer.
     * 
     * Specifically, "saving" a file really means giving the user the
     * opportunity to download the file to their computer.  Consequently, this
     * method will fail if the given file object contains a path, since we
     * cannot dictate where the user must download it.  However, you may specify
     * a filename, and it will be the initial suggestion in the download dialog
     * that appears subsequently, but the user can change it thereafter.
     * 
     * An important limitation here is that we do not know whether the user
     * actually accepted the download or not; we simply initiate the process and
     * let the user go from there.  Consequently, this function will say that
     * the file is saved, when in reality, we know only that the saving process
     * was initiated, and the user is responsible for the rest.  They might
     * cancel the download, and yet the app (not knowing that) thinks that they
     * have saved the file, and will let them close the app without prompting
     * them to save their work, nor auto-saving it for them.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#write the abstract
     *   method of the parent class}
     */
    write ( fileObject ) {
        // Case 1: Invalid input of various types
        if ( !fileObject )
            throw new Error( 'File object required for saving' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( fileObject.path )
            throw new Error( 'OfflineFileSystem does not support paths' )
        if ( !fileObject.hasOwnProperty( 'contents' ) )
            throw new Error( 'No content to write' )
        // Case 2: Contents provided, and optionally also the filename
        if ( !fileObject.hasOwnProperty( 'filename' ) )
            fileObject.filename = 'Untitled'
        fileObject.fileSystemName = this.getName()
        downloadFile( this.editor, fileObject.filename )
        this.documentSaved( fileObject )
        return Promise.resolve( fileObject )
    }

}
