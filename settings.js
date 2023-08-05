
/**
 * A class representing the values of the user's settings in an app.  Instances
 * of this class require metadata so that the settings can be presented to the
 * user in a dialog for editing.
 * 
 * The class inherits from `Map`, which allows you to call `has(key)`,
 * `get(key)`, `set(key,value)`, `delete(key)`, and `clear()`.  We augment this
 * built-in functionality with additional methods for loading, saving, and
 * allowing the user to edit the settings interactively.
 */
export class Settings extends Map {
    /**
     * Construct a collection of settings with the given name and metadata.
     * Only settings whose metadata appear in the given `metadata` will be used
     * for load, save, or editing purposes.  (You can `.set()` other things, but
     * this class will ignore them.)
     * 
     * @param {String} name - the name of this collection of settings, which
     *   will be shown to the user in the title of the dialog box presented when
     *   editing the settings
     * @param {SettingsMetadata} metadata - the metadata definitions for all
     *   settings that will be stored in this object
     */
    constructor ( name, metadata ) {
        super()
        this.name = name
        this.metadata = metadata
        this.defaults = metadata.defaultSettings()
    }
    /**
     * This should be viewed as the set of allowed keys for this app's settings.
     * They are the keys that show up in the metadata, and are thus the only
     * keys that this object pays attention to (even if you add settings with
     * other names).
     * 
     * @returns {String[]} the keys from the metadata for these settings; see
     *   `SettingsMetadata.keys()` for more information
     */
    keys () { return this.metadata.keys() }
    /**
     * Load from the browser's `localStorage` all settings whose names show up
     * in this object's metadata, and convert them to the appropriate types using
     * that metadata.  For any value not in `localStorage`, fill this object
     * with its default value instead (as given by the metadata).
     */
    load () {
        const allowedKeys = this.keys()
        for ( let i = 0 ; i < localStorage.length ; i++ ) {
            const key = localStorage.key( i )
            if ( !key.startsWith( 'lurch-' ) ) continue
            const subkey = key.substring( 6 )
            if ( allowedKeys.includes( subkey ) ) {
                const metadata = this.metadata.metadataFor( subkey )
                const loaded = localStorage.getItem( key )
                this.set( subkey, metadata ? metadata.convert( loaded ) : loaded )
            }
        }
        allowedKeys.forEach( key => {
            if ( !this.has( key ) ) this.set( key, this.defaults[key] )
        } )
    }
    /**
     * For every setting that is stored in this object and whose key is allowed,
     * according to this object's metadata, save the key-value pair into the
     * browser's `localStorage` object.
     */
    save () {
        this.keys().forEach( key => {
            if ( this.has( key ) )
                localStorage.setItem( `lurch-${key}`, this.get( key ) )
        } )
    }
    /**
     * Show to the user a dialog box for editing this settings object.  If the
     * user clicks OK, any changes they made will be saved back into this
     * object.  If the user clicks cancel, no changes they made in the dialog
     * will be retained or stored in this object or anywhere else.
     * 
     * Returns a promise as described below.  Note that if the user edits the
     * settings and closes the dialog, that impacts the contents of this object,
     * but not the contents of the browser's `localStorage`.  If the client
     * wishes the new settings to be saved, they should call this object's
     * `save()` function when the promise resolves.
     * 
     * The promise resolves whether the user clicks OK or cancel, but in the
     * case of cancel, an empty array is passed (no settings changed).  The
     * promise rejects only if some unexpected error occurs; that would be
     * considered a bug, so the intent is for the promise to always resolve.
     * 
     * @param {tinymce.Editor} editor - the editor in which to show the dialog
     * @returns {Promise} a promise that resolves when the user closes the
     *   dialog, and passes an array of all setting names that the user changed.
     */
    userEdit ( editor ) {
        const originalSettings = { }
        Array.from( this.keys() ).forEach( key =>
            originalSettings[key] = this.has( key ) ? this.get( key )
                                                    : this.defaults[key] )
        return new Promise( ( resolve, reject ) => {
            const dialog = editor.windowManager.open( {
                title : this.name,
                size : 'medium',
                body : this.metadata.control(),
                buttons : [
                    { text : 'OK', type : 'submit' },
                    { text : 'Cancel', type : 'cancel' }
                ],
                initialData : originalSettings,
                onSubmit : () => {
                    const results = dialog.getData()
                    dialog.close()
                    const changedKeys = Object.keys( results ).filter(
                        key => results[key] != originalSettings[key] )
                    changedKeys.forEach( key => this.set( key, results[key] ) )
                    resolve( changedKeys )
                },
                onCancel : () => resolve( [ ] ) // nothing changed (cancel)
            } )
        } )
    }
}
