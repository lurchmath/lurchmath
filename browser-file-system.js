
import { FileSystem } from './file-system.js'

// Internal use only
// Prefix for distinguishing which LocalStorage keys are for Lurch files
const prefix = 'lurch-file-'

// Internal use only
// Get a list of all files in LocalStorage
const allFileNames = () => {
    let result = [ ]
    for ( let i = 0 ; i < window.localStorage.length ; i++ )
        if ( window.localStorage.key( i ).startsWith( prefix ) )
            result.push( window.localStorage.key( i ).substring( prefix.length ) )
    return result
}

/**
 * A subclass of {@link FileSystem} that represents a flat file system in the
 * browser's `localStorage` object.  It implements all the abstract methods of
 * the parent class, but specific to that one storage location.
 * 
 * Because it is a flat file system, the `path` member of file objects is not
 * used.  (In some methods below, if that member is present and is a nonempty
 * string, then the method will fail in the way documented in that method.)
 * Also, UIDs are not used by this file system; rather, filenames are used to
 * identify files.  UIDs are ignored in all methods of this class.
 */
export class BrowserFileSystem extends FileSystem {

    static subclassName = FileSystem.registerSubclass(
        'in-browser storage', BrowserFileSystem )

    /**
     * See the documentation of the {@link FileSystem#read read()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a flat file system in the
     * browser's `localStorage` object, as defined at {@link BrowserFileSystem
     * the documentation for this class}.
     * 
     * Because this is a flat file system, any file object with a nonempty path
     * member will not exist, regardless of its filename, and will therefore
     * result in an error being thrown.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#read the abstract
     *   method of the parent class}
     */
    read ( fileObject ) {
        // error cases
        if ( !fileObject?.filename )
            return Promise.reject( new Error( 'Missing filename' ) )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( !this.has( fileObject ) )
            return Promise.reject( new Error( 'File does not exist' ) )
        // correct case
        fileObject.contents = window.localStorage.getItem(
            prefix + fileObject.filename )
        fileObject.fileSystemName = this.getName()
        return Promise.resolve( fileObject )
    }

    /**
     * See the documentation of the {@link FileSystem#write write()} method in
     * the parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a flat file system in the
     * browser's `localStorage` object, as defined at {@link BrowserFileSystem
     * the documentation for this class}.
     * 
     * Because this is a flat file system, any file object with a nonempty path
     * member will not exist, regardless of its filename, and will therefore
     * result in an error being thrown.
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
            throw new Error( 'BrowserFileSystem does not support subfolders' )
        if ( !fileObject.hasOwnProperty( 'filename' ) )
            throw new Error( 'No filename provided' )
        if ( !fileObject.hasOwnProperty( 'contents' ) )
            throw new Error( 'No content to write' )
        // Case 2: Everything we need was provided, can save
        fileObject.fileSystemName = this.getName()
        window.localStorage.setItem( prefix + fileObject.filename,
            fileObject.contents )
        this.documentSaved( fileObject )
        return Promise.resolve( fileObject )
    }

    /**
     * See the documentation of the {@link FileSystem#delete delete()} method in
     * the parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a flat file system in the
     * browser's `localStorage` object, as defined at {@link BrowserFileSystem
     * the documentation for this class}.
     * 
     * Because this is a flat file system, any file object with a nonempty path
     * member will not exist, regardless of its filename, and will therefore
     * result in an error being thrown.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#delete the abstract
     *   method of the parent class}
     */
    delete ( fileObject ) {
        // Case 1: Invalid input of various types
        if ( !fileObject?.filename )
            throw new Error( 'No filename provided' )
        if ( !this.has( fileObject ) )
            throw new Error( 'File does not exist' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        if ( fileObject.path )
            throw new Error( 'BrowserFileSystem does not support subfolders' )
        // Case 3: Name of file provided, so we can delete
        fileObject.fileSystemName = this.getName()
        window.localStorage.removeItem( prefix + fileObject.filename )
        return Promise.resolve( fileObject )
    }

    /**
     * See the documentation of the {@link FileSystem#has has()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a flat file system in the
     * browser's `localStorage` object, as defined at {@link BrowserFileSystem
     * the documentation for this class}.
     * 
     * Because this is a flat file system, any file object with a nonempty path
     * member will not exist, regardless of its filename, and will therefore
     * result in a false value being resolved from the promise.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#has the abstract
     *   method of the parent class}
     */
    has ( fileObject ) {
        if ( !fileObject )
            throw new Error( 'Missing required file object argument' )
        if ( fileObject.fileSystemName
          && fileObject.fileSystemName != this.getName() )
            throw new Error( `Wrong file system: ${fileObject.fileSystemName}` )
        return Promise.resolve(
            !fileObject.path && allFileNames().includes( fileObject.filename )
        )
    }

    /**
     * See the documentation of the {@link FileSystem#list list()} method in the
     * parent class for the definition of how this method must behave.  It
     * implements the requirements specified there for a flat file system in the
     * browser's `localStorage` object, as defined at {@link BrowserFileSystem
     * the documentation for this class}.
     * 
     * In particular, because this is a flat file system, no parameter should be
     * passed to attempt to list files in a subfolder, since there are no
     * subfolders.  Any attempt to do so will result in an error, unless the
     * parameter is a file object with an empty string for its path.
     * 
     * @param {Object} fileObject - as documented in the {@link FileSystem}
     *   class
     * @returns {Promise} as documented in {@link FileSystem#list the abstract
     *   method of the parent class}
     */
    list ( fileObject ) {
        if ( fileObject?.path )
            throw new Error( 'BrowserFileSystem does not support subfolders' )
        return Promise.resolve( allFileNames().map( filename => {
            return {
                fileSystemName: this.getName(),
                filename : filename
            }
        } ) )
    }

}
