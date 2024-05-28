
import { FileSystem } from './file-system.js'
import { Dialog } from './dialog.js'
import { UploadItem, downloadFile } from './upload-download.js'

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
     * See the documentation of the {@link FileSystem#open open()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a file system that
     * represents the user's own computer.
     * 
     * Specifically, "opening" a file really means giving the user the
     * opportunity to choose a file from their computer to upload into the app.
     * Consequently, this method will fail if the given file object contains a
     * specific filename, since we cannot dictate which file the user must
     * upload; they get to choose.  It will also fail if any nonempty path is
     * specified, since we cannot dictate anything about folders on the user's
     * computer, nor about browsing specific ones.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#open the abstract
     *   method of the parent class}
     */
    open ( fileObject ) {
        // Case 1: It's an error to specify filenames or paths
        if ( fileObject?.filename )
            throw new Error( 'OfflineFileSystem cannot open specific files' )
        if ( fileObject?.path )
            throw new Error( 'OfflineFileSystem does not support paths' )
        // Case 2: When the caller provided no parameter, allow uploading
        return new Promise( ( resolve, reject ) => {
            const dialog = new Dialog( 'Upload File', this.editor )
            dialog.addItem( new UploadItem( 'uploadedFile', 'File to open' ) )
            dialog.show().then( userHitOK => {
                if ( !userHitOK ) resolve()
                const { filename, content } = dialog.get( 'uploadedFile' )
                resolve( {
                    fileSystemName : this.getName(),
                    filename : filename,
                    contents : content
                } )
            } ).catch( reject )
        } )
    }

    /**
     * See the documentation of the {@link FileSystem#save save()} method in the
     * parent class for the definition of how this method must behave.  It
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
     * @returns {Promise} as documented in {@link FileSystem#save the abstract
     *   method of the parent class}
     */
    save ( fileObject ) {
        // Case 1: Invalid input of various types
        if ( !fileObject )
            throw new Error( 'File object required for saving' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( fileObject.path )
            throw new Error( 'OfflineFileSystem does not support paths' )
        if ( !fileObject.hasOwnProperty( 'contents' ) )
            throw new Error( 'No content to save' )
        // Case 2: Contents provided, and optionally also the filename
        if ( !fileObject.hasOwnProperty( 'filename' ) )
            fileObject.filename = 'Untitled'
        fileObject.fileSystemName = this.getName()
        downloadFile( this.editor, fileObject.filename )
        this.documentSaved( fileObject )
        return Promise.resolve( fileObject )
    }

}
