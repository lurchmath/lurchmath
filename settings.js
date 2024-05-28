
import { ShowWarningSettingMetadata } from './settings-metadata.js'
import { Dialog } from './dialog.js'

/**
 * A class representing the values of the user's settings in an app.  Instances
 * of this class require metadata so that the settings can be presented to the
 * user in a dialog for editing.
 * 
 * The class inherits from `Map`, which allows you to call `keys()`, `has(key)`,
 * `get(key)`, `set(key,value)`, `delete(key)`, and `clear()`.  We augment this
 * built-in functionality with additional methods for loading, saving, and
 * allowing the user to edit the settings interactively.
 * 
 * @see {@link SettingsMetadata}
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
     *   {@link SettingsMetadata#keys SettingsMetadata.keys()} for more
     *   information
     * @see {@link Settings#has has()}
     */
    keys () { return this.metadata.keys() }

    /**
     * A settings object has a key if and only if that key appears as part of
     * its metadata, which was given at construction time.  Even if no value has
     * been assigned for the key, the settings object still has it, associated
     * with its default value.  Even if other keys have been set, we ignore them
     * because they do not appear in the schema given at construction time.
     * 
     * @param {string} key - the key whose presence should be checked
     * @returns {boolean} whether the key appears in this settings object
     * @see {@link Settings#keys keys()}
     * @see {@link Settings#get get()}
     */
    has ( key ) { return this.keys().includes( key ) }

    /**
     * If the given key does not appear in the metadata given at construction
     * time, then undefined is returned.  Otherwise, if the key has had a value
     * associated with it via a previous call to `set()`, then we return that
     * value.  Otherwise, we return the default value given in the metadata for
     * the given key.
     * 
     * @param {string} key - the key to look up
     * @returns {any} the value stored under the key, or the default value for
     *   that key if none has yet been set
     * @see {@link Settings#has has()}
     */
    get ( key ) {
        return !this.has( key ) ? undefined :
               super.has( key ) ? super.get( key ) : this.defaults[key]
    }

    /**
     * Load from the browser's `localStorage` all settings whose names show up
     * in this object's metadata, and convert them to the appropriate types using
     * that metadata.  For any value not in `localStorage`, fill this object
     * with its default value instead (as given by the metadata).
     * 
     * @see {@link Settings#save save()}
     * @see {@link Settings#reset reset()}
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
    }

    /**
     * For every setting that is stored in this object and whose key is allowed,
     * according to this object's metadata, save the key-value pair into the
     * browser's `localStorage` object.
     * 
     * @see {@link Settings#load load()}
     * @see {@link Settings#reset reset()}
     */
    save () {
        this.keys().forEach( key => {
            if ( this.has( key ) )
                localStorage.setItem( `lurch-${key}`, this.get( key ) )
        } )
    }

    /**
     * This does not clear only this object, but also erases all the user's
     * saved settings.  It should be used if the user wants to reset the
     * application to its default settings by erasing any customization they
     * have made so far, so that every setting returns to its default value.
     * 
     * @see {@link Settings#load load()}
     * @see {@link Settings#save save()}
     */
    reset () {
        this.keys().forEach( key => localStorage.removeItem( `lurch-${key}` ) )
        this.clear()
        this.load()
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
     * @see {@link Settings#load load()}
     * @see {@link Settings#save save()}
     */
    userEdit ( editor ) {
        const originalSettings = { }
        Array.from( this.keys() ).forEach( key =>
            originalSettings[key] = this.has( key ) ? this.get( key )
                                                    : this.defaults[key] )
        return new Promise( ( resolve, _ ) => {
            const dialog = editor.windowManager.open( {
                title : this.name,
                size : 'medium',
                body : this.metadata.control(),
                buttons : [
                    { text : 'OK', type : 'submit' },
                    { text : 'Cancel', type : 'cancel' },
                    {
                        text : 'Reset all',
                        type : 'custom',
                        align : 'start',
                        name : 'reset-all'
                    }
                ],
                initialData : originalSettings,
                onSubmit : () => {
                    const results = dialog.getData()
                    const errors = this.metadata.validate( results )
                    if ( errors.length > 0 ) {
                        let message = 'Cannot save preferences due to these errors:<br/>'
                        errors.forEach( ( text, index ) => {
                            message += `${index + 1}. ${text}<br/>`
                        } )
                        Dialog.failure( editor, message, 'Fix errors before saving' )
                        return
                    }
                    dialog.close()
                    const changedKeys = Object.keys( results ).filter(
                        key => results[key] != originalSettings[key] )
                    changedKeys.forEach( key => this.set( key, results[key] ) )
                    resolve( changedKeys )
                },
                onCancel : () => resolve( [ ] ), // nothing changed (cancel)
                onAction : ( _, details ) => {
                    if ( details.name == 'reset-all' ) {
                        Dialog.areYouSure(
                            editor,
                            'Clear all your settings and reset them to the defaults?'
                        ).then( userHitOK => {
                            if ( userHitOK ) {
                                dialog.close()
                                resolve( [ ] )
                                setTimeout( () => {
                                    this.reset()
                                    this.userEdit( editor )
                                } )
                            }
                        } )
                    }
                }
            } )
        } )
    }

    /**
     * When a user attempts to take a dangerous action (e.g., delete something
     * important) the application may need to pop up a warning asking whether
     * the user really meant to take that action, so that the application does
     * not take the action if it was an accident on the user's part.  This
     * function makes that easy.
     * 
     * First, the application settings metadata must contain a setting
     * corresponding to the warning we want to display, for the reasons
     * described in the {@link ShowWarningSettingMetadata} class.  (See that
     * link for details.)
     * 
     * Second, the client can call this function and pass the name of the
     * warning setting in question and the editor over which to pop up the
     * warning dialog if one is needed.  The client receives a promise in return
     * that resolves if the user wants to proceed and rejects otherwise.  The
     * user also has the opportunity to say they always want to proceed, which
     * will tweak the corresponding warning setting in this object
     * appropriately.
     * 
     * Example use:
     * ```js
     * settings.showWarning( 'warn before delete files', editor ).then( () => {
     *     // put here the code that deletes the files
     * } ).catch( () => { } ) // to ensure no errors if they say no
     * ```
     * 
     * @param {string} settingName - the name of the setting for the warning
     * @param {tinymce.Editor} editor - the editor instance over which to pop up
     *   the dialog, if one needs to be shown
     * @returns {Promise} a promise that resolves if the user chooses to proceed
     *   with the action and rejects if the user chooses not to proceed
     * @see {@link ShowWarningSettingMetadata}
     */
    showWarning ( settingName, editor ) {
        // If this is not a warning setting, throw an error.
        const metadata = this.metadata.metadataFor( settingName )
        if ( !metadata || !( metadata instanceof ShowWarningSettingMetadata ) )
            throw new Error( 'No such warning setting: ' + settingName )
        const message = metadata.warningText + '<br/>'
            + 'Are you sure you want to proceed?'
        // If the user says not to show this warning, return a resolved promise
        // so that subsequent client actions will be invoked immediately.
        if ( !this.get( settingName ) ) return Promise.resolve()
        // Otherwise return a promise whose resolution is contintgent upon the
        // user's response to the appropriate warning dialog.
        return new Promise( ( resolve, _ ) => {
            const dialog = editor.windowManager.open( {
                title : 'Warning',
                body : {
                    type : 'panel',
                    items : [
                        {
                            type : 'alertbanner',
                            level : 'warn',
                            icon : 'warning',
                            text : message
                        }
                    ],
                },
                buttons : [
                    {
                        text : 'Yes',
                        name : 'yes',
                        buttonType : 'secondary',
                        type : 'custom'
                    },
                    {
                        text : 'Yes and do not ask again',
                        name : 'yes-and',
                        buttonType : 'secondary',
                        type : 'custom'
                    },
                    {
                        text : 'No',
                        name : 'no',
                        buttonType : 'primary',
                        type : 'custom'
                    }
                ],
                onAction : ( _, details ) => {
                    dialog.close()
                    if ( details.name == 'no' )
                        return resolve( false )
                    if ( details.name == 'yes-and' ) {
                        this.set( settingName, false )
                        this.save()
                    }
                    resolve( true )
                }
            } )
        } )
    }

    /**
     * A "hidden" setting is one that will not show up in the settings dialog,
     * but will still be stored in the user's local storage.  This can be used
     * when some other part of the application wants to store a value that is
     * determined by user preference, but its purpose and/or type make it not
     * very sensible to add to the settings dialog.
     * 
     * This function can be used to write such hidden settings, and the
     * corresponding {@link Settings#loadHiddenSetting loadHiddenSetting()} to
     * read them.
     * 
     * Note that this function does police its parameters in one way, that the
     * key for the setting must not be the key for a non-hidden setting.  Other
     * than that, it can be anything the caller desires.  That way, it ensures
     * that the caller does not accidentally overwrite a non-hidden setting with
     * a hidden setting.
     * 
     * @param {string} key - the key under which to store the setting
     * @param {string} value - the value to store
     * @see {@link Settings#loadHiddenSetting loadHiddenSetting()}
     */
    saveHiddenSetting ( key, value ) {
        if ( this.has( key ) )
            throw new Error( 'Non-hidden setting already exists with key: ' + key )
        localStorage.setItem( `lurch-${key}`, value )
    }

    /**
     * A "hidden" setting is one that will not show up in the settings dialog,
     * but will still be stored in the user's local storage.  This can be used
     * when some other part of the application wants to store a value that is
     * determined by user preference, but its purpose and/or type make it not
     * very sensible to add to the settings dialog.
     * 
     * This function can be used to read such hidden settings, and the
     * corresponding {@link Settings#setHiddenSetting setHiddenSetting()} to
     * write them.
     * 
     * Note that this function does police its parameters in one way, that the
     * key for the setting must not be the key for a non-hidden setting.  Other
     * than that, it can be anything the caller desires.  That way, it ensures
     * that the caller does not accidentally write code that behaves as if a
     * setting is hidden when it is not.
     * 
     * @param {string} key - the key under which the setting was stored
     * @returns {string} the value retrieved
     * @see {@link Settings#saveHiddenSetting saveHiddenSetting()}
     */
    loadHiddenSetting ( key ) {
        if ( this.has( key ) )
            throw new Error( 'Non-hidden setting already exists with key: ' + key )
        return localStorage.getItem( `lurch-${key}` )
    }
    
}
