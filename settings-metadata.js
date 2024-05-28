
/**
 * This file serves two purposes.  First, it defines a suite of classes for
 * specifying the metdata (i.e., schema) for the settings of any given app, as
 * long as those settings are of a small, finite set of data types (text, bool,
 * color, categorical).  Secondly, it uses those classes to define the metadata
 * for the actual settings for the Lurch app, and exports that metadata as a
 * constant that the rest of the app can access through an `import` statement.
 */

import { copyWithoutPrototype } from './utilities.js'

/**
 * Every setting in the app must come with some metadata, including its name
 * (a unique key used for saving it), its label (what prompt will be shown on
 * screen to the user when editing the setting), and its default value (which
 * will be its value before the user has ever edited or even seen that setting).
 * This abstract base class supports just those three features, but does not do
 * anything useful with them yet, except provide generic functionality factored
 * out of most subclasses.
 * 
 * This is not to be confused with {@link SettingsMetadata} (note the plural),
 * which is for an entire collection of settings.  This one (the singular) is
 * the metadata for just one setting.
 */
export class SettingMetadata {

    /**
     * Construct a metadata record about a setting in the app.
     * 
     * @param {String} name - the unique key for this setting
     * @param {String} label - the prompt shown to the user when editing this
     *   setting
     * @param {any} defaultValue - the default value for this setting
     */
    constructor ( name, label, defaultValue ) {
        this.name = name
        this.label = label
        this.defaultValue = defaultValue
    }

    /**
     * Whenever this setting needs to be presented to the user in the UI, this
     * function will be called to create JSON data representing the setting,
     * which should be the kind of data representing a control in TinyMCE's
     * custom dialog interface, documented here:
     * https://www.tiny.cloud/docs/tinymce/6/dialog-components/
     * 
     * @returns {Object} an object representing the UI control for this setting
     */
    control () {
        const result = copyWithoutPrototype( this )
        delete result.defaultValue
        return result
    }

    /**
     * When a new value for this setting is provided, it may be of the wrong
     * type (e.g., because it was loaded from `localStorage`, which can only
     * store strings).  This function can be used to convert the data back into
     * the appropriate type for this setting.
     * 
     * @param {any} data - the data to convert to the appropriate type
     * @returns {any} the same data, possibly converted to a new type
     */
    convert ( data ) { return data }

    /**
     * By default, a setting does not have any error checking built in.  Thus
     * its validate function always returns an empty array, meaning no errors.
     * This can be customized in subclasses to return a list of error messages
     * (each one a string suitable for display in a TinyMCE dialog).
     * 
     * @param {Object} data - the data currently in the UI for this setting,
     *   as produced by a call to `getData()` in the dialog, followed by
     *   looking up the specific value associated with this setting's name
     * @returns {String[]} an array of error messages, or an empty array if
     *   there are no errors (as in this default implementation)
     */
    validate ( _ ) { return [ ] }

}

/**
 * A subclass of {@link SettingMetadata} for boolean values
 */
export class BoolSettingMetadata extends SettingMetadata {

    /**
     * Passes the parameters to the superclass for initialization, then marks
     * this setting as one that should be represented in the UI using a
     * checkbox.
     * 
     * @param  {...any} args - same arguments as for the superclass constructor
     */
    constructor ( ...args ) {
        super( ...args )
        this.type = 'checkbox'
    }

    /**
     * Treats `true` as true and `"true"` as true, but all other values as
     * false.
     * 
     * @param {any} data - the data to convert to boolean
     * @returns {bool} the same data, now as a boolean
     */
    convert ( data ) { return data === true || data === 'true' }

}

/**
 * A subclass of {@link SettingMetadata} for whether to show a warning
 * 
 * There are often situations in an application where a user has attempted to
 * take a dangerous action (e.g., delete something important) and the
 * application pops up a warning first asking the user to confirm that they
 * really meant to take that action.  It is common to give the user an option on
 * such a warning dialog along the lines of "Don't show this warning again."
 * 
 * But in order to make the user's choice permanent, it must be stored in the
 * application settings.  And of course the user must also be able to edit it
 * there, in case they change their mind.
 * 
 * This is therefore the metadata for a special type of boolean setting whose
 * meaning is "Show warnings before doing X," for some value of X.  In other
 * words, a true value means to show the warning and a false value means not to
 * show the warning.  Such settings always default to true, and the user can
 * change them to false if they wish.
 * 
 * @see {@link BoolSettingMetadata}
 */
export class ShowWarningSettingMetadata extends BoolSettingMetadata {

    /**
     * Marks this setting as a checkbox with the given name and label, set its
     * default value to true, and also stores the warning text that will be
     * shown to users if they attempt an action associated with this warning.
     * Note the importance highlighted below of phrasing the checkbox's label in
     * a way that is consistent with the meaning of this setting.
     * 
     * @param {string} name - same as in {@link BoolSettingMetadata}
     * @param {string} label - same as in {@link BoolSettingMetadata}, but note
     *   that in this case it means the label shown next to the checkbox, which
     *   must match the semantics of this metadata, and thus should be phrased
     *   something like "Show warnings before..."
     * @param {string} warningText - the message to be printed in the dialog
     *   box when the warning is shown.  This should therefore be descriptive
     *   text, one or two sentences, so that the user understands the warning.
     */
    constructor ( name, label, warningText ) {
        super( name, label, true )
        this.warningText = warningText
    }

}

/**
 * A subclass of {@link SettingMetadata} for color values
 */
export class ColorSettingMetadata extends SettingMetadata {

    /**
     * Passes the parameters to the superclass for initialization, then marks
     * this setting as one that should be represented in the UI using a
     * color picker.
     * 
     * @param  {...any} args - same arguments as for the superclass constructor
     */
    constructor ( ...args ) {
        super( ...args )
        this.type = 'colorinput'
    }

}

/**
 * A subclass of {@link SettingMetadata} for short text values
 * 
 * @see {@link LongTextSettingMetadata}
 */
export class TextSettingMetadata extends SettingMetadata {

    /**
     * Passes the parameters to the superclass for initialization, then marks
     * this setting as one that should be represented in the UI using a
     * text input widget (a single-line input control, not a multi-line editor).
     * 
     * @param  {...any} args - same arguments as for the superclass constructor,
     *   plus an optional validator function that will be used as the
     *   implementation of {@link SettingMetadata#validate validate()} for this
     *   instance.  (See the signature documented there for details.)
     */
    constructor ( name, label, defaultValue, validator ) {
        super( name, label, `${defaultValue}` )
        this.type = 'input'
        this.validator = validator
    }

    /**
     * Validate the contents of the setting, if the user provided a validator
     * function at construction time.  Otherwise, just do what the superclass
     * does.  See {@link SettingMetadata#validate validate()} for details.
     */
    validate ( data ) {
        return this.validator ? this.validator( data ) : super.validate( data )
    }

}

/**
 * A subclass of {@link SettingMetadata} for long text values
 * 
 * @see {@link TextSettingMetadata}
 */
export class LongTextSettingMetadata extends SettingMetadata {

    /**
     * Passes the parameters to the superclass for initialization, then marks
     * this setting as one that should be represented in the UI using a
     * textarea input widget (a multi-line input control, not just a one-line
     * input).
     * 
     * @param  {...any} args - same arguments as for the superclass constructor,
     *   plus an optional validator function that will be used as the
     *   implementation of {@link SettingMetadata#validate validate()} for this
     *   instance.  (See the signature documented there for details.)
     */
    constructor ( name, label, defaultValue, validator ) {
        super( name, label, `${defaultValue}` )
        this.type = 'textarea'
        this.validator = validator
    }

    /**
     * Validate the contents of the setting, if the user provided a validator
     * function at construction time.  Otherwise, just do what the superclass
     * does.  See {@link SettingMetadata#validate validate()} for details.
     */
    validate ( data ) {
        return this.validator ? this.validator( data ) : super.validate( data )
    }

}

/**
 * A subclass of {@link SettingMetadata} for categorical values
 * 
 * (Not to be confused with {@link SettingsCategoryMetadata}, which groups a
 * list of settings into a category of settings.  This is a single setting that
 * lets the user choose one value from a finite list of options, a "categorical"
 * data type.)
 */
export class CategorySettingMetadata extends SettingMetadata {

    /**
     * Passes the parameters to the superclass for initialization, then marks
     * this setting as one that should be represented in the UI using a
     * drop-down list with the given array of values as its options.
     * 
     * @param {String} name - passed to superclass constructor
     * @param {String} label - passed to superclass constructor
     * @param {String[]} options - array of valid values in this categorical
     *   data type, in the order they should be presented to the user when
     *   editing a setting with this metadata
     * @param {String} defaultValue - passed to superclass constructor; should
     *   be on the list of `options`
     */
    constructor ( name, label, options, defaultValue ) {
        if ( defaultValue === undefined )
            defaultValue = options[0]
        super( name, label, `${defaultValue}` )
        this.type = 'selectbox'
        this.items = options.map( option => {
            return { value : `${option}`, text : `${option}` }
        } )
    }

    /**
     * Ensures that the value given is on the list of valid values.  If it is
     * not, it replaces it with the first value on the list of valid values.
     * 
     * @param {any} data - the data to convert to an item in this category
     * @returns {String} the same data, if it is a valid element in this
     *   category, or the first valid element in this category otherwise
     */
    convert ( data ) {
        return this.items.some( item => item.value === `${data}` ) ?
            `${data}` : this.items[0].value
    }

}

// Possible other subclasses of SettingMetadata we could create later:
// Slider, Textarea, maybe 1-2 more

/**
 * A subclass of {@link SettingMetadata} that does not actually correspond to
 * any setting, but can be useful to include in metadata to insert notes in
 * between controls when the settings are edited in the user interface.
 */
export class NoteMetadata extends SettingMetadata {

    // For internal use only
    // Converts TinyMCE alert banner types into appropriate icon names
    static styleToIcon = {
        info : 'info',
        warn : 'warning',
        error : 'notice',
        success : 'selected'
    }

    /**
     * Construct a metadata record that does not correspond to any setting, but
     * to a note that should be inserted between settings when they are
     * displayed to the user for editing.
     * 
     * @param {String} content - contents of the note when displayed in the UI,
     *   which can be in a limited subset of HTML
     * @param {String} style - how to display the note (must be `"info"`,
     *   `"warn"`, `"error"`, or `"success"` to create an alert banner, or
     *   omitted, i.e., undefined, to create plain HTML content with no banner)
     */
    constructor ( content, style ) {
        super()
        if ( style ) {
            if ( !NoteMetadata.styleToIcon.hasOwnProperty( style ) )
                throw new Error( `Invalid note style: ${style}` )
            this.type = 'alertbanner'
            this.level = style
            this.icon = NoteMetadata.styleToIcon[style]
            this.text = content
        } else {
            this.type = 'htmlpanel'
            this.html = content
        }
    }

}

/**
 * A subclass of {@link SettingMetadata} that does not actually correspond to
 * just one setting, but to a sequence of settings collected together into a
 * named category.  This is useful for presenting settings to the user with a
 * sensible organization into tabs/pages with appropriate names/headings.
 * 
 * @see {@link SettingsMetadata}
 */
export class SettingsCategoryMetadata extends SettingMetadata {

    /**
     * Create a new metadata item for a category of settings
     * 
     * @param {String} name - the name of the category, used as a title in the
     *   user interface when presenting this category to the user for editing
     * @param {SettingMetadata[]} contents - the metadata for each setting in
     *   this catyegory, in the order they should be shown to the user when
     *   editing
     */
    constructor ( name, ...contents ) {
        super()
        this.name = name
        this.contents = contents
    }

    /**
     * Whenever this category needs to be presented to the user in the UI, this
     * function will be called to create JSON data representing the category,
     * which will be a tab for use in a tabbed dialog, as documented here:
     * {@link https://www.tiny.cloud/docs/tinymce/6/dialog-components/#tabpanel}
     * 
     * @returns {Object} an object representing the UI tab for this category of
     *   settings
     */
    control () {
        return {
            name : this.name,
            title : this.name,
            items : this.contents.map( metadata => metadata.control() )
        }
    }

    /**
     * Creates an ordered list of all the names of all the settings in this
     * category.  (The "name" of each setting is used as the "key" in any
     * key-value dictionary representing settings, hence the term "keys.")
     * 
     * @returns {String[]} the keys in the order they appear in this category
     */
    keys () {
        return this.contents.map( metadata => metadata.name )
                            .filter( name => !!name )
    }

    /**
     * For all settings in this category, look up their default values and
     * return the result as an object mapping setting names to those default
     * values.
     * 
     * @returns {Object} a set of key-value pairs mapping names of settings to
     *   their default values for all settings in this category
     */
    defaultSettings () {
        const result = { }
        this.contents.forEach( metadata => {
            if ( metadata.name ) result[metadata.name] = metadata.defaultValue
        } )
        return result
    }

    /**
     * Given a setting's name, we can look up its metadata and return the
     * appropriate {@link SettingMetadata} instance, if one with that name
     * exists in this category.  Otherwise, we return undefined.
     * 
     * @param {String} key the name of the setting whose metadata we should look
     *   up
     * @returns {SettingMetadata} the metadata in question, or undefined if no
     *   such metadata exists in this category
     */
    metadataFor ( key ) {
        return this.contents.find( metadata => metadata.name == key )
    }

    /**
     * Validate all the settings in this category and return all their error
     * messages concatenated into a single array.  If there were no error
     * messages (which is the default) then the result will be an empty list,
     * indicating that the data passes validation.
     * See {@link SettingMetadata#validate validate()} for details.
     */
    validate ( data ) {
        return this.contents.map( item => item.validate( data[item.name] ) ).flat()
    }

}

/**
 * A subclass of {@link SettingMetadata} that does not actually correspond to
 * just one setting, but to an entire collection of settings, organized into
 * categories.  So the singular {@link SettingMetadata} is for just one, and
 * those are collected into categories using {@link SettingsCategoryMetadata},
 * and those categories are collected into the full set of settings for an app
 * using this class, {@link SettingsMetadata} (the plural of
 * {@link SettingMetadata}).
 * 
 * Because each {@link SettingsCategoryMetadata} will be presented to the user
 * as a tab on a dialog, and this class represents several categories, it is
 * presented to the user as a dialog with one or more tabs, one for each
 * category contained in this collection.
 * 
 * @see {@link SettingsCategoryMetadata}
 * @see {@link Settings}
 */
export class SettingsMetadata extends SettingMetadata {

    /**
     * Create a collection of settings categories
     * 
     * @param  {SettingsCategoryMetadata[]} categories - the categories in this
     *   settings collection, in the order they should be shown to the user when
     *   editing settings
     */
    constructor ( ...categories ) {
        super()
        this.categories = categories
    }

    /**
     * Whenever this collection needs to be presented to the user in the UI,
     * this function will be called to create JSON data representing the
     * collection, which will be the body of a dialog, as exemplified here:
     * {@link https://www.tiny.cloud/docs/tinymce/6/dialog-components/#dialog-instance-api-methods}
     * 
     * @returns {Object} an object representing the body of a dialog that would
     *   let the user edit this collection of settings
     */
    control () {
        return {
            type : 'tabpanel',
            tabs : this.categories.map( category => category.control() )
        }
    }

    /**
     * Creates an ordered list of all the names of all the settings in this
     * collection.  (The "name" of each setting is used as the "key" in any
     * key-value dictionary representing settings, hence the term "keys.")
     * 
     * @returns {String[]} the keys in the order they appear in this collection
     */
    keys () {
        return this.categories.map( category => category.keys() )
                              .reduce( ( a, b ) => [ ...a, ...b ], [ ] )
    }

    /**
     * For all settings in this collection, look up their default values and
     * return the result as an object mapping setting names to those default
     * values.
     * 
     * @returns {Object} a set of key-value pairs mapping names of settings to
     *   their default values for all settings in this collection
     */
    defaultSettings () {
        return this.categories.map(
            category => category.defaultSettings()
        ).reduce( ( a, b ) => {
            return { ...a, ...b }
        }, { } )
    }

    /**
     * Given a setting's name, we can look up its metadata and return the
     * appropriate {@link SettingMetadata} instance, if one with that name exists in
     * this collection.  Otherwise, we return undefined.
     * 
     * @param {String} key the name of the setting whose metadata we should look
     *   up
     * @returns {SettingMetadata} the metadata in question, or undefined if no
     *   such metadata exists in this collection
     */
    metadataFor ( key ) {
        for ( let i = 0 ; i < this.categories.length ; i++ ) {
            const result = this.categories[i].metadataFor( key )
            if ( result ) return result
        }
    }

    /**
     * Validate all the settings in all the categories and return all their
     * error messages concatenated into a single array.  If there were no error
     * messages (which is the default) then the result will be an empty list,
     * indicating that the data passes validation.
     * See {@link SettingMetadata#validate validate()} for details.
     */
    validate ( data ) {
        return this.categories.map( category => category.validate( data ) ).flat()
    }

}
