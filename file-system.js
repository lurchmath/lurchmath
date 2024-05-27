
import {
    Dialog, LongTextInputItem, AlertItem, TextInputItem
} from './dialog.js'
import { LurchDocument } from './lurch-document.js'
import { appURL } from './utilities.js'

// Internal use only
// Tools for auto-saving the user's work as they edit, and for loading that work
// later if they never manually saved it and need to recover it.
const autoSaveKey = 'lurch-autosave'
const autoSaveFrequencyInSeconds = 5
const autoSave = content =>
    window.localStorage.setItem( autoSaveKey, content )
const getAutoSave = () => window.localStorage.getItem( autoSaveKey )
const autoSaveExists = () => {
    for ( let i = 0 ; i < window.localStorage.length ; i++ )
        if ( window.localStorage.key( i ) == autoSaveKey ) return true
    return false
}
const removeAutoSave = () => window.localStorage.removeItem( autoSaveKey )

/**
 * A FileSystem is a place where files can be saved and/or loaded.  This is
 * intentionally vague, so that many different types of sources or destinations
 * can be treated as filesystems, each with different features.  Examples
 * include each of the following, which will be implemented as subclasses:
 * 
 *  - A cloud storage platform such as Dropbox, which has a wide variety of
 *    features for listing, loading, saving, deleting, and renaming files.
 *  - The browser's `localStorage` object, which can store arbitrary key-value
 *    pairs, and can thus be used as a simple file system with all the same
 *    features as a cloud storage platform, but very limited space and no
 *    transferability between browsers or computers.
 *  - The user's hard drive, which can load and save files only with manual user
 *    intervention, and which does not let a web application list folder
 *    contents, delete files, or rename files.
 *  - A web repository of files, such as a GitHub repository or simply a folder
 *    on a public server, which can list files and load them, but will not let
 *    this web application save, delete, or rename files in that web repository.
 * 
 * This class therefore provides many abstract methods for the various actions
 * described above (loading, saving, etc.) and is intended to be subclassed to
 * implement specific file systems.
 * 
 * We formalize here tne definition of one central concept, a "file object."  It
 * will be a JavaScript object with some subset of the following fields.
 * 
 *  - `fileSystemName` - the name of the file system from which the file
 *    originated or was last saved.  If this field is absent, then the file was
 *    created in the application and has not yet been saved anywhere.
 *  - `filename` - the name of the file in the file system, written in a way
 *    that is sensible for a human user to read.  For example, some cloud
 *    storage systems might have unique IDs for files that are not
 *    human-readable, but by contrast this field should be the name the user
 *    gave the file.  This field should be set when a file is read from a file
 *    system, and will be absent if and only if the user created the file in the
 *    application and has not yet saved it.  (Or they saved it to a file system
 *    that does not tell the application the name that the user chose, such as
 *    the user's hard drive through a download operation.)
 *  - `UID` - a unique identifier for the file in the file system.  This is not
 *    necessarily a globally unique ID, but is unique within the file system
 *    named in the first attribute, above.  This field should not be present if
 *    the `fileSystemName` field is absent, because a file system gives the file
 *    its ID, so we cannot have this field without the other first.  Some
 *    file systems may be sufficiently simple that they operate using only the
 *    human-readable filename in the `filename` field, in which case this field
 *    can be omitted.
 *  - `path` - a string representing the path in which the file is stored.  If
 *    the file system does not use paths, then this may be absent.  But a file
 *    object can represent a folder by setting this field to a path but omitting
 *    the filename and UID.  Such a file object can be passed as the parameter
 *    to the file listing function to list the contents of a folder, or the file
 *    open function, to specify which folder's files the user should be choosing
 *    from by default.
 *  - `contents` - the contents of the file, as a string.  This field will be
 *    present if the file object is one that the application wants to save, by
 *    passing to a saving function, because obviously the file cannot be saved
 *    without its content.  Similarly, the field will be present if this file
 *    object is being returned from a file loading operation, since that was the
 *    purpose of the operation.  But this field may be absent if the file object
 *    is part of a directory listing, or is a parameter being passed to a file
 *    loading function, since the contents are either unnecessary or impossible
 *    in such situations.
 */
export class FileSystem {

    // Internal use only: Stores a mapping from subclass names to subclasses of
    // the FileSystem class.  Public use of this data should be done through the
    // registerSubclass() function below; clients do not need to read this data.
    static subclasses = new Map()

    /**
     * This class tracks its collection of subclasses so that we can find a
     * file system by its name, or get a list of all file systems registered.
     * We may need to find a file system by name if we have a file we need to
     * save into that system (which knows the name of the file system it came
     * from) and we may need to get a list of all file systems to populate the
     * submenus for file open, file save, etc.
     * 
     * Example of registering a subclass:
     * 
     * ```js
     * class Example extends FileSystem { ... }
     * FileSystem.registerSubclass( 'Example', Example )
     * ```
     * 
     * @param {string} name - the name of the subclass to register
     * @param {Object} subclass - the subclass itself
     * @see {@link FileSystem#getName getName()}
     */
    static registerSubclass ( name, subclass ) {
        FileSystem.subclasses.set( name, subclass )
        return name
    }

    /**
     * Get a FileSystem subclass by name.  For more information about
     * registering subclasses, see the {@link module:FileSystem.registerSubclass
     * registerSubclass()} static member.
     * 
     * @param {string} name - the name of the subclass to get
     * @returns {Object} the subclass with the given name
     * @see {@link FileSystem#getName getName()}
     */
    static getSubclass ( name ) {
        return FileSystem.subclasses.get( name )
    }

    /**
     * Get a list of all registered file systems.  For more information about
     * registering subclasses, see the {@link module:FileSystem.registerSubclass
     * registerSubclass()} static member.
     * 
     * @returns {Array} the list of all registered file systems
     * @see {@link FileSystem.getSubclass getSubclass()}
     */
    static getSubclasses () {
        return Array.from( FileSystem.subclasses.values() )
    }

    /**
     * Get the name of a given {@link FileSystem} subclass, by looking it up in
     * the list of registered subclasses.  For more information about
     * registering subclasses, see the {@link module:FileSystem.registerSubclass
     * registerSubclass()} static member.
     * 
     * @param {Object} subclass - the subclass to look up
     * @returns {string} the name of the given subclass (or undefined if the
     *   given object is not a subclass that was registered)
     * @see {@link FileSystem.getSubclass getSubclass()}
     * @see {@link FileSystem.getName getName()}
     */
    static getSubclassName ( subclass ) {
        return Array.from( FileSystem.subclasses.keys() ).find( name =>
            subclass === FileSystem.getSubclass( name ) )
    }

    /**
     * Get the name of the class of this file system, by looking its class up in
     * the list of registered subclasses.  For more information about
     * registering subclasses, see the {@link module:FileSystem.registerSubclass
     * registerSubclass()} static member.
     * 
     * @returns {string} the name of the class of this file system (or undefined
     *   if this instance is a member of a subclass that was not registered)
     * @see {@link FileSystem.getSubclass getSubclass()}
     * @see {@link FileSystem.getSubclassName getSubclassName()}
     */
    getName () {
        return Array.from( FileSystem.subclasses.keys() ).find( name =>
            this instanceof FileSystem.getSubclass( name ) )
    }

    /**
     * Construct a file system and associate it with a given TinyMCE editor.
     */
    constructor ( editor ) {
        this.editor = editor
    }

    /**
     * The following member functions of the {@link FileSystem} class are
     * abstract, and thus have empty implementations in the base class: `open`,
     * `save`, `delete`, `has`, and `list`.  Subclasses may choose to implement
     * some of them, as documented in {@link FileSystem the class itself}.  You
     * can test whether a specific instance of the class implements a given
     * feature by calling this function on its name, passed as a string.
     * 
     * @param {string} name - the name of the feature, from the list above
     * @returns {boolean} whether this file system implements the given feature
     */
    implements ( name ) { return this[name] != FileSystem.prototype[name] }

    /**
     * This abstract method opens a file from the file system.  It is abstract
     * in the sense that the base implementation returns a promise that
     * immediately rejects with an error that the method is unimplemented.
     * Subclasses that provide the ability to open files must override this base
     * implementation.  Any implementation in a subclass should satisfy the
     * following criteria.
     * 
     *  1. If the user passes a file object parameter (as documented in {@link
     *     FileSystem the FileSystem class}) with enough information in it to
     *     identify a file, then this method should return a promise that
     *     resolves to that file as soon as it can be loaded.  Specifically, it
     *     should not prompt the user for their involvement, and the object to
     *     which the promise resolves should be the same object as the one
     *     passed in, but with its `contents` member set to the contents of the
     *     file.
     *  2. If the user omits the parameter, then this method should prompt the
     *     user to choose a file from the list supplied by the file system.  If
     *     the user cancels, the promise should resolve to null.  If the user
     *     chooses a file, then the promise should resolve to the file object
     *     that was chosen, with its contents filled in after it has been
     *     loaded.
     *  3. If the user supplies this parameter, but it has no filename nor UID,
     *     but has a path field, then the same behavior should take place as in
     *     case 2, above, but the dialog that lets the user browse for the file
     *     should begin in the folder whose path is given in the file object.
     *  4. If the user sends an invalid file object, or some error takes place
     *     during the loading process, then the promise should reject.
     * 
     * In any of the successful cases above, set the file system name to this
     * file system's name, marking this resource as the origin of the file.
     * Any subclass that implements this method should also implement the
     * {@link FileSystem#has has()} and {@link FileSystem#list list()} methods.
     * 
     * @param {Object} [fileObject] - an object representing the file to open,
     *   as described above
     * @returns {Promise} a promise that resolves or rejects as described in the
     *   criteria above
     * @see {@link FileSystem#has has()}
     * @see {@link FileSystem#list list()}
     */
    open ( fileObject ) {
        return new Promise( ( _, reject ) => {
            reject( new Error( '"open" unimplemented in FileSystem class' ) )
        } )
    }

    /**
     * This abstract method saves a file to the file system.  It is abstract in
     * the sense that the base implementation returns a promise that immediately
     * rejects with an error that the method is unimplemented.  Subclasses that
     * provide the ability to save files must override this base implementation.
     * Any implementation in a subclass should satisfy the following criteria.
     * 
     *  1. If the file object's `fileSystemName` does not match the name of this
     *     instance, throw an error, because the caller is asking us to save in
     *     a place to which we have no access.  However, if the `fileSystemName`
     *     was omitted, then on a successful save, update it to the name of this
     *     subclass.
     *  2. If the file object's `contents` member is undefined, throw an error,
     *     because we have no content to save.
     *  3. If the file object contains sufficient information in its `filename`,
     *     `UID`, and `path` members to let this file system know where to save
     *     the content, then save the given contents into the file system and
     *     resolve to a (possibly updated) file object on success, or reject if
     *     an error occurred when attempting to save.
     *  4. If the file object does not provide sufficient information in its
     *     `filename`, `UID`, and `path` members to let this file system know
     *     where to save the content, prompt the user for it in a dialog.  How
     *     much information must be provided may vary from one file system to
     *     another.  If the user cancels, resolve the promise to null.  If the
     *     user does not cancel, then proceed as in the previous bullet.
     *  5. Any time a file is successfully saved, before resolving the promise,
     *     the subclass should call the static method
     *     {@link FileSystem.documentSaved documentSaved()} in the FileSystem
     *     class.  This tells the application to delete the last auto-saved
     *     content, because if it did not do so, then upon the next launch of
     *     the application, it would tell the user that it has recovered unsaved
     *     work (which is not true; they just saved it).
     * 
     * @param {Object} fileObject - an object representing the file to save,
     *   as described above, and as documented in {@link FileSystem the
     *   FileSystem class})
     */
    save ( fileObject ) {
        return new Promise( ( _, reject ) => {
            reject( new Error( '"save" unimplemented in FileSystem class' ) )
        } )
    }

    /**
     * This abstract method deletes a file from the file system.  It is abstract
     * in the sense that the base implementation returns a promise that
     * immediately rejects with an error that the method is unimplemented.
     * Subclasses that provide the ability to delete files must override this
     * base implementation.  Any implementation in a subclass should satisfy the
     * following criteria.
     * 
     *  1. If the file object's `fileSystemName` does not match the name of this
     *     instance, throw an error, because the caller is asking us to delete
     *     a file in a different file system.  However, if the `fileSystemName`
     *     was omitted, the on a successful deletion, update it to the name of
     *     this subclass.
     *  2. If the client passes a file object as parameter, and it contains
     *     sufficient information in its `path`, `filename`, and `UID` members
     *     to uniquely determine a file, then delete the file from the file
     *     system and resolve to a (possibly updated) file object on success, or
     *     reject if an error occurred when attempting to delete.
     *  3. If the client passes a file object as parameter, and it contains
     *     sufficient information to uniquely determine a file, but that file
     *     does not actually exist, reject with an error.
     *  4. If the client passes a file object as parameter, and it does not
     *     contain sufficient information in its `path`, `filename`, and `UID`
     *     members to uniquely determine a file, then show the user a dialog in
     *     which the user can select the file to delete.  If the user cancels,
     *     resolve the promise to null.  If the user does not cancel, then
     *     proceed as in item 2.
     * 
     * @param {Object} fileObject - an object representing the file to delete,
     *   as described above, and as documented in {@link FileSystem the
     *   FileSystem class})
     * @returns {Promise} a promise that resolves or rejects as described in the
     *   criteria above
    */
    delete ( fileObject ) {
        return new Promise( ( _, reject ) => {
            reject( new Error( '"delete" unimplemented in FileSystem class' ) )
        } )
    }

    /**
     * This abstract method answers the question of whether the file system
     * contains a file with the criteria specified in the parameter.  It is
     * abstract in the sense that the base implementation returns a promise that
     * immediately rejects with an error that the method is unimplemented.
     * Subclasses that provide the ability to read files (by implementing the
     * {@link FileSystem#open open()} method) should also provide this method by
     * overriding this base implementation.  Any implementation in a subclass
     * should satisfy the following criteria.
     * 
     *  1. If the client passes a file object as parameter, and it contains
     *     sufficient information in its `path`, `filename`, and `UID` members
     *     to uniquely determine a file, then return a promise that checks
     *     whether the specified file exists in the file sytem and resolves to
     *     the result, as a boolean value.  The promise should reject only if an
     *     error occurs when attempting to check whether the file exists.
     *  2. In all other cases, throw an error.  This includes a missing
     *     parameter, insufficient information in the parameter, or a parameter
     *     whose `fileSystemName` does not match the name of this file system.
     * 
     * @param {Object} fileObject - an object representing the file being
     *   queried, as described above, and as documented in {@link FileSystem the
     *   FileSystem class})
     * @returns {Promise} a promise that resolves or rejects as described in the
     *   criteria above
     * @see {@link FileSystem#open open()}
     */
    has ( fileObject ) {
        return new Promise( ( _, reject ) => {
            reject( new Error( '"has" unimplemented in FileSystem class' ) )
        } )
    }

    /**
     * This abstract method returns a promise that resolves to a list of
     * objects representing all files in the file system.  It is abstract in the
     * sense that the base implementation returns a promise that immediately
     * rejects with an error that the method is unimplemented.  Subclasses that
     * provide the ability to read files (by implementing the {@link
     * FileSystem#open open()} method) should also provide this method by
     * overriding this base implementation.  Any implementation in a subclass
     * should satisfy the following criteria.
     * 
     *  1. If the client omits the parameter, then return a promise that gets
     *     the list of all files in the root of the file system and resolves to
     *     a JavaScript array of file objects (which are documented in {@link
     *     FileSystem the FileSystem class}).  The promise should reject only if
     *     an error occurs when attempting to get the list of files.  Note that
     *     a folder may contain subfolders, and those can be included in the
     *     list of results returned, because file objects have the capability of
     *     representing folders as well.  For details, see the {@link
     *     FileSystem documentation for the FileSystem class}.
     *  2. If the client passes a file object as parameter, and it contains a
     *     `path` member, then proceed exactly as in item 1., above, but not in
     *     the root of the file system, rather in the path provided.  If such a
     *     path does not exist, reject with an error.
     * 
     * @param {Object} [fileObject] - an object representing the path whose
     *   files should be listed, or if omitted, the root of the file system is
     *   assumed instead
     * @returns {Promise} a promise that resolves or rejects as described in the
     *   criteria above
     * @see {@link FileSystem#open open()}
     */
    list ( fileObject ) {
        return new Promise( ( _, reject ) => {
            reject( new Error( '"list" unimplemented in FileSystem class' ) )
        } )
    }

    /**
     * This static member should be called by any subclass that implements the
     * {@link FileSystem#save save()} method, whenever a save is successful,
     * because there are two responses that the system must give to any
     * successful file save.
     * 
     *  1. Delete the most recent auto-save.  If we did not delete the
     *     auto-saved content, then on the next launch of the application, the
     *     user would be alerted to the fact that unsaved work existed in the
     *     auto-save file and could be recovered for them.  But that would be
     *     false, because of course, they just did save their work.
     *  2. Store the file object representing the file just saved, so that it
     *     can be stored in the {@link LurchDocument} for the editor.  If the
     *     user later invokes a "save" menu item, its event handler can use the
     *     stored file object as the parameter to the {@link FileSystem#save
     *     save()} method.
     * 
     * The file object passed to this function should have enough uniquely
     * identifying information in its `filename`, `UID`, and `path` members to
     * satisfy the requirements of the {@link FileSystem#save save()} method for
     * the same file system subclass.  If its `contents` member has data in it,
     * that data will be ignored, so that it is not unnecessarily copied.  No
     * `fileSystemName` needs to be provided; each subclass will use its own.
     * 
     * @param {Object} fileObject - the file object representing the file that
     *   was just saved (and whose format is documented in the {@link
     *   FileSystem} class)
     * @see {@link FileSystem#save save()}
     */
    documentSaved ( fileObject ) {
        removeAutoSave()
        new LurchDocument( this.editor ).setFileID( {
            fileSystemName : this.getName(),
            filename : fileObject.filename,
            UID : fileObject.UID,
            path : fileObject.path
        } )
    }

    /**
     * Show a "File Open" dialog to browse this file system and return a promise
     * that resolves to the selected file (or null if the user cancels).  The
     * dialog is used for choosing a file, but it doesn't have to be with the
     * purpose of opening the file; for example, you could use it to choose a
     * file to delete, if you provide appropriate values for the second and
     * third parameters.
     * 
     * @param {String} [initialPath] - initial path at which to start browsing,
     *   defaults to the file system root
     * @param {String} [title] - title for the dialog, defaults to "Open file"
     * @param {String} [submit] - the name of the submit button, defaults to
     *   "Open"
     * @returns {Promise} a promise that resolves to the selected file object if
     *   the user chooses a file to open, resolves to null if the user cancels,
     *   and rejects if an error occurs
     */
    showOpenDialog ( initialPath = '', title = 'Open file', submit = 'Open' ) {
        // Create a dialog and put a FolderContentsItem in it
        const dialog = new Dialog( title, this.editor )
        dialog.json.size = 'medium'
        dialog.setOK( submit )
        const folderContentsItem = new FolderContentsItem( this, initialPath )
        folderContentsItem.setSelectable( true )
        dialog.addItem( folderContentsItem )
        // Ensure we can only click the "Open" button if a file is selected
        folderContentsItem.selectionChanged = () =>
            dialog.dialog.setEnabled( 'OK',
                !!folderContentsItem.get( 'selectedFile' ) )
        // Make double-click do the same thing as click-and-then-hit-Open
        folderContentsItem.onDoubleClick = () => {
            if ( folderContentsItem.get( 'selectedFile' ) )
                dialog.json.onSubmit()
        }
        // Don't submit the dialog if Open was clicked when a folder was
        // selected; instead, navigate inside of it
        const standardSubmitRoutine = dialog.json.onSubmit
        dialog.json.onSubmit = () => {
            const selected = folderContentsItem.get( 'selectedFile' )
            if ( !selected )
                throw new Error( 'Submit should not be active without a selection' )
            if ( selected.filename ) // they are opening a file
                standardSubmitRoutine()
            else // they are opening a folder
                folderContentsItem.setPath( selected.path )
        }
        // Show the dialog and give the caller access to its promise (sort of)
        const result = new Promise( ( resolve, reject ) =>
            dialog.show()
                .then( clickedOK =>
                    resolve( clickedOK && dialog.get( 'selectedFile' ) ) )
                .catch( reject ) )
        dialog.dialog.setEnabled( 'OK', false )
        return result
    }
    
    /**
     * Show a "File Save" dialog to browse this file system and return a promise
     * that resolves to a file object that refers to the user's chosen save
     * location (or null if the user canceled).
     * 
     * @param {String} [initialPath] - initial path at which to start browsing,
     *   defaults to the file system root
     * @param {String} [initialFilename] - initial filename used in the dialog,
     *   defaults to the empty string
     * @param {String} [title] - title for the dialog, defaults to "Save file"
     * @param {String} [submit] - the name of the submit button, defaults to
     *   "Save"
     * @returns {Promise} a promise that resolves to the a file object if the
     *   user chooses a location to save, resolves to null if the user cancels,
     *   and rejects if an error occurs
     */
    showSaveDialog (
        initialPath = '', initialFilename = '',
        title = 'Save file', submit = 'Save'
    ) {
        // Create a dialog and put a FolderContentsItem in it, plus a text input
        const dialog = new Dialog( title, this.editor )
        dialog.json.size = 'medium'
        dialog.setOK( submit )
        dialog.addItem( new TextInputItem( 'filename', 'Filename' ) )
        dialog.setInitialData( { filename : initialFilename } )
        const folderContentsItem = new FolderContentsItem( this, initialPath )
        folderContentsItem.setSelectable( true )
        dialog.addItem( folderContentsItem )
        // Convenience functions for computing our return value
        let lastFilename = null
        const currentFilename = () => {
            if ( !dialog.element ) return lastFilename // dialog has closed
            return lastFilename =
                dialog.querySelector( 'input[type="text"]' ).value
        }
        const fileObjectResult = () => { return {
            fileSystemName : this.getName(),
            path : folderContentsItem.getPath(),
            filename : currentFilename()
        } }
        // Don't submit the dialog if Save was clicked when a folder was
        // selected; instead, navigate inside of it
        const standardSubmitRoutine = dialog.json.onSubmit
        dialog.json.onSubmit = () => {
            // If they are trying to open a folder, navigate inside it
            const selected = folderContentsItem.get( 'selectedFile' )
            if ( selected && !selected.filename ) {
                folderContentsItem.setPath( selected.path )
                return
            }
            // If the file already exists, ensure the user wants to overwrite it
            this.has( fileObjectResult() ).then( exists => {
                if ( exists ) {
                    Dialog.areYouSure( this.editor, 'Overwrite existing file?' )
                        .then( yesImSure => {
                            if ( yesImSure ) standardSubmitRoutine()
                        } )
                    return
                }
                // The file does not already exist, so go ahead and save there
                standardSubmitRoutine()
            } )
        }
        // Show the dialog and give the caller access to its promise (sort of)
        const result = new Promise( ( resolve, reject ) =>
            dialog.show()
                .then( clickedOK => resolve( clickedOK && fileObjectResult() ) )
                .catch( reject ) )
        dialog.dialog.setEnabled( 'OK', false )
        // Ensure we can only click the "Save" button if a filename is present
        const filenameInput = dialog.querySelector( 'input[type="text"]' )
        const filenameNonEmpty = () => /\S/.test( filenameInput.value )
        filenameInput.addEventListener( 'input', () =>
            dialog.dialog.setEnabled( 'OK', filenameNonEmpty() ) )
        // Make selecting an item change the contents of the filename input
        folderContentsItem.selectionChanged = () => {
            const selectedItem = folderContentsItem.get( 'selectedFile' )
            if ( selectedItem ) filenameInput.value = selectedItem.filename
            dialog.dialog.setEnabled( 'OK', filenameNonEmpty() )
        }
        // Make double-click do the same thing as click-and-then-hit-Open
        folderContentsItem.onDoubleClick = () => {
            if ( filenameNonEmpty() ) dialog.json.onSubmit()
        }
        return result
    }
    
}

// Internal use only
// Checks whether the user minds discarding their recent work before proceeding.
const ensureWorkIsSaved = editor => new Promise( ( resolve, reject ) => {
    if ( !editor.isDirty() )
        return resolve( true )
    Dialog.areYouSure(
        editor,
        'You will lose any unsaved work.  Continue anyway?'
    ).then( resolve, reject )
} )

/**
 * Install into a TinyMCE editor instance several core features related to
 * files, including all of the following.
 * 
 *  - File menu items:
 *     - New
 *     - Open (a submenu of choices, one for each file system)
 *     - Save (tries to use the last file system, or reverts to save as...)
 *     - Save as... (a submenu of choices, one for each file system)
 *     - Delete (a submenu of choices, one for each file system)
 *     - Embed...
 *  - An auto-save timer that stores a copy of the current document every few
 *    seconds when it is dirty (if the app options enable this feature)
 *  - A popup dialog that appears on app launch if and only if there is an
 *    existing auto-saved document, offering to reload that unsaved work (if the
 *    app options enable this feature)
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const install = editor => {
    if ( FileSystem.getSubclasses().length === 0 )
        throw new Error( 'Cannot install file menu items with no file systems' )
    // First, three file menu items are independent of which file systems are
    // loaded or in use: File > New (since it doesn't save/load anything),
    // File > Save (since it tries to use wherever you last saved), and
    // File > Embed (since it also does not load/save anything).
    editor.ui.registry.addMenuItem( 'newlurchdocument', {
        text : 'New',
        icon : 'new-document',
        tooltip : 'New document',
        shortcut : 'alt+N',
        onAction : () => ensureWorkIsSaved( editor ).then( saved => {
            if ( saved ) new LurchDocument( editor ).newDocument()
        } )
    } )
    editor.ui.registry.addMenuItem( 'savedocument', {
        text : 'Save',
        tooltip : 'Save document',
        onAction : () => {
            const fileID = new LurchDocument( editor ).getFileID()
            const filesystem = FileSystem.getSubclass( fileID?.fileSystemName )
            if ( !filesystem )
                fileID.fileSystemName = FileSystem.getSubclassName(
                    FileSystem.getSubclasses()[0] )
            instance.save( fileID ).then(
                result => console.log( 'saved:', result ) )
        }
    } )
    editor.ui.registry.addMenuItem( 'embeddocument', {
        text : 'Embed...',
        tooltip : 'Embed document in a web page',
        onAction : () => {
            const html = new LurchDocument( editor ).getDocument()
            const iframe = document.createElement( 'iframe' )
            iframe.src = `${appURL()}?data=${encodeURIComponent( btoa( html ) )}`
            iframe.style.width = '800px'
            iframe.style.height = '400px'
            const dialog = new Dialog( 'Embedding code', editor )
            dialog.json.size = 'medium'
            // We must put the styles in the element itself, to override
            // TinyMCE's very aggressive CSS within dialogs:
            dialog.addItem( new LongTextInputItem( 'code',
                'Copy the following code into your web page' ) )
            dialog.setInitialData( { code : iframe.outerHTML } )
            dialog.removeButton( 'Cancel' )
            dialog.setDefaultFocus( 'code' )
            dialog.show()
            const textarea = dialog.querySelector( 'textarea' )
            textarea.select()
            textarea.setAttribute( 'readonly', 'true' )
            textarea.setAttribute( 'rows', 15 )
            textarea.scrollTo( 0, 0 )
        }
    } )
    // Now create all the menu items that will (by default) go in the submenus
    // File > Open, File > Save as, and File > Delete, one for each file system
    // subclass that has been registered.  Of course, custom app setups through
    // createApp() can move these around if they don't like this organization.
    const simplifiedNames = [ ]
    FileSystem.getSubclasses().forEach( subclass => {
        const name = subclass.subclassName
        const simplifiedName = name.toLowerCase().replace( /[^a-z]/gi, '' )
        simplifiedNames.push( simplifiedName )
        // File > Open... > Open from X...
        editor.ui.registry.addMenuItem( 'opendocument' + simplifiedName, {
            text : `Open from ${name}...`,
            tooltip : `Open document from ${name}`,
            shortcut : 'alt+O',
            onAction : () => ensureWorkIsSaved( editor ).then( saved => {
                if ( saved ) {
                    new subclass( editor ).open().then( result => {
                        if ( result ) {
                            const LD = new LurchDocument( editor )
                            LD.setDocument( result.contents )
                            LD.setFileID( {
                                fileSystemName : name,
                                path : result.path,
                                filename : result.filename,
                                UID : result.UID
                            } )
                            Dialog.notify( editor, 'success',
                                `Loaded ${result.filename} from ${name}.` )
                        }
                    } )
                }
            } )
        } )
        // File > Save as... > Save to X as...
        editor.ui.registry.addMenuItem( 'savedocumentas' + simplifiedName, {
            text : `Save to ${name} as...`,
            tooltip : `Save document to ${name} as...`,
            shortcut : 'alt+shift+S',
            onAction : () => {
                new subclass( editor ).save( {
                    contents : new LurchDocument( editor ).getDocument()
                } ).then( result => console.log( 'saved:', result ) )
            }
        } )
        // File > Delete... > Delete from X...
        editor.ui.registry.addMenuItem( 'deletesaved' + simplifiedName, {
            text : `Delete from ${name}...`,
            tooltip : `Delete a document from ${name}`,
            onAction : () => {
                new subclass( editor ).delete().then(
                    result => console.log( 'deleted!', result ) )
            }
        } )
    } )
    // Now create the top-level File menu items into which you browse to find
    // the ones for each file system.  That is, we now create the File > Open
    // item, which contains submenu items, and File > Save as..., etc.
    editor.ui.registry.addNestedMenuItem( 'opendocument', {
        text : 'Open...',
        tooltip : 'Open document',
        getSubmenuItems : () => simplifiedNames.map(
            simplifiedName => 'opendocument' + simplifiedName ).join( ' ' )
    } )
    editor.ui.registry.addNestedMenuItem( 'savedocumentas', {
        text : 'Save as...',
        tooltip : 'Save document as...',
        getSubmenuItems : () => simplifiedNames.map(
            simplifiedName => 'savedocumentas' + simplifiedName ).join( ' ' )
    } )
    editor.ui.registry.addNestedMenuItem( 'deletesaved', {
        text : 'Delete...',
        tooltip : 'Delete a saved document',
        getSubmenuItems : () => simplifiedNames.map(
            simplifiedName => 'deletesaved' + simplifiedName ).join( ' ' )
    } )
    // If the auto-save feature is enabled, then wait for the app to finish
    // loading, and then check to see if there is any autosaved data that was
    // never saved by the user.  If so, offer to recover it.  Also, set up the
    // auto-save recurring timer (again iff that feature is enabled).
    if ( editor.appOptions.autoSaveEnabled ) {
        editor.on( 'init', () => {
            // First, if there's an auto-save, offer to load it:
            if ( autoSaveExists() ) {
                const dialog = new Dialog( 'Unsaved work exists', editor )
                dialog.addItem( new AlertItem(
                    'warn',
                    'There is an unsaved document stored in your browser.  '
                  + 'This could be from another copy of Lurch running in another tab, '
                  + 'or from a previous session in which you did not save your work.'
                ) )
                dialog.setButtons(
                    { text : 'Load it', type : 'submit', buttonType : 'primary' },
                    { text : 'Delete it', type : 'cancel' }
                )
                dialog.show().then( choseToLoad => {
                    if ( choseToLoad )
                        new LurchDocument( editor ).setDocument( getAutoSave() )
                    else
                        new LurchDocument( editor )
                    removeAutoSave()
                } )
            } else {
                new LurchDocument( editor )
            }
            // Next, set up the recurring timer for autosaving:
            setInterval( () => {
                if ( editor.isDirty() )
                    autoSave( new LurchDocument( editor ).getDocument() )
            }, autoSaveFrequencyInSeconds * 1000 )
        } )
    }
}

/**
 * An item that can be added to a {@link Dialog} to allow the user to browse the
 * contents of a {@link FileSystem} and interact with the files therein.
 */
export class FolderContentsItem {

    /**
     * Construct a new folder contents item for browsing the given file system.
     * Optionally you may also specify in which subfolder the browsing begins.
     * 
     * @param {FileSystem} fileSystem - the file system to browse
     * @param {String} [initialPath] - the path to start in (defaults to the
     *   file system root, which works for every file system, even those that
     *   do not have subfolders)
     */
    constructor ( fileSystem, initialPath = '' ) {
        this.fileSystem = fileSystem
        this.path = initialPath
        this.itemsAreSelectable = false
        this.selectedItem = null
    }

    /**
     * This is initially set in the constructor, but it may change as the user
     * browses the contents of the file system.
     * 
     * @returns {String} the current path being browsed
     */
    getPath () { return this.path }

    /**
     * This sets the path that should be shown in the item and forces a
     * repopulation of the item's contents based on that new path.  The new
     * path must be valid or the behavior of the item hereafter is undefined.
     * 
     * @param {String} newPath - the new path to display
     */
    setPath ( newPath ) {
        this.path = newPath
        const isVisible = this.dialog
            && this.dialog.querySelector( '#dialog-folder-contents-item' )
        if ( isVisible ) this.repopulate()
    }

    /**
     * Switch the mode of this item to permit selecting items (`on` true) or not
     * permit selecting items (`on` false).  Turning this off removes the
     * current selection, if there is one.
     * 
     * @param {boolean} on - whether items are selectable
     */
    setSelectable ( on = true ) {
        this.itemsAreSelectable = on
        if ( !on ) this.selectItem( null, null )
    }

    // internal use only; selects an item
    selectItem ( fileDiv, fileObject ) {
        this.dialog.querySelectorAll( '.file-div' ).forEach(
            div => div.style.backgroundColor = '' )
        if ( fileDiv ) fileDiv.style.backgroundColor = 'lightblue'
        this.selectedItem = fileObject
        this.selectionChanged?.()
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'htmlpanel',
            html : '<div id="dialog-folder-contents-item">Loading...</div>'
        } ]
    }

    // internal use only; repopulate the contents of the item with the files
    // list in the current folder (and clear any old selection)
    repopulate () {
        this.selectedItem = null
        const panel = this.dialog.querySelector( '#dialog-folder-contents-item' )
        this.fileSystem.list( { path : this.path } ).then( files => {
            panel.innerHTML = files.length > 0 ? '' : 'No files in this folder.'
            files.forEach( fileObject => {
                // put a new item into the panel
                const fileDiv = panel.ownerDocument.createElement( 'div' )
                panel.appendChild( fileDiv )
                // give it content
                fileDiv.innerHTML = fileObject.filename ?
                    `&#x1F4C4; ${fileObject.filename}` :
                    `&#x1F4C1; ${fileObject.path}`
                // style it
                fileDiv.classList.add( 'file-div' )
                fileDiv.style.border = 'solid 1px #cccccc'
                fileDiv.style.overflowY = 'scroll'
                fileDiv.style.cursor = 'default'
                fileDiv.width = '100%'
                // Add event handlers to items
                fileDiv.addEventListener( 'click', () => setTimeout( () => {
                    if ( !this.dialog.element )
                        return // dialog has closed since the timeout started
                    // If items are selectable, update the selection
                    if ( this.itemsAreSelectable ) {
                        if ( this.selectedItem == fileObject )
                            this.selectItem( null, null )
                        else
                            this.selectItem( fileDiv, fileObject )
                    }
                    // Let users install an onClick() handler
                    this.onClick?.( fileObject )
                } ) )
                fileDiv.addEventListener( 'dblclick', () => {
                    // Let users install an onDoubleClick() handler
                    this.onDoubleClick?.( fileObject )
                } )
            } )
        } ).catch( error => {
            panel.innerHTML = 'Error loading file list.  See console for details.'
            console.error( 'Error loading file list:', error )
        } )
    }

    // internal use only; called when the dialog is shown
    onShow () { this.repopulate() }

    // internal use only; returns a file object if requested by the dialog's
    // get() function
    get ( key, _ ) {
        if ( key == 'selectedFile' ) return this.selectedItem
    }

}

export default { FileSystem, install }