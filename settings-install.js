
/**
 * This module exports one function that installs in a TinyMCE editor features
 * for editing application settings, and it also exports the settings object
 * itself, for reading/writing specific settings.
 * 
 * @module SettingsInstaller
 */

import { Settings } from './settings.js'
import {
    SettingsMetadata, SettingsCategoryMetadata, ShowWarningSettingMetadata,
    CategorySettingMetadata
} from './settings-metadata.js'

/**
 * This is a silly example of app setting metadata for now, because we have not
 * yet defined what the actual settings for this app will be.  However, this
 * collection of settings includes one from each type of setting, and two
 * different categories, so that we can test settings dialogs now, even before
 * we have the full collection of settings we will actually show to users in the
 * Lurch app.  Later, we can replace this with the actual definition of the
 * metadata for the app's settings.
 * 
 * @see {@link Settings}
 */
export const appSettings = new Settings(
    'Application settings',
    new SettingsMetadata(
        new SettingsCategoryMetadata(
            'Application warnings',
            new ShowWarningSettingMetadata(
                'warn before extract header',
                'Show warning before moving the header into the document',
                'Moving the header into the document is an action that cannot be undone.'
            ),
            new ShowWarningSettingMetadata(
                'warn before embed header',
                'Show warning before moving document content into header',
                'Moving content into the header is an action that cannot be undone.'
            )
        ),
        new SettingsCategoryMetadata(
            'Editor appearance',
            new CategorySettingMetadata(
                'application width in window',
                'Width of application in browser window',
                [ 'Fixed size', 'Full width' ],
                'Full width'
            )
        ),
        new SettingsCategoryMetadata(
            'File load/save',
            new CategorySettingMetadata(
                'default open dialog tab',
                'Default source for loading files',
                [ 'From browser storage', 'From your computer', 'From the web' ],
                'From browser storage'
            ),
            new CategorySettingMetadata(
                'default save dialog tab',
                'Default destination for saving files',
                [ 'To browser storage', 'To your computer' ],
                'To browser storage'
            )
        )
    )
)

// Internal use only
// Called when the user says OK in the app settings dialog.
// Parameter is a list of what settings they changed (array of string keys),
// or undefined if the app has just loaded and we need to apply loaded changes.
const applySettings = changes => {
    // First, if there were any changes, save the settings to the browser.
    if ( changes && changes.length > 0 ) appSettings.save()
    // Now, for any change that must result in some code being run now to alter
    // the app's behavior, run that code.
    if ( !changes || changes.includes( 'application width in window' ) ) {
        // If max width desired, just let CSS come through, because it has a
        // max width built in.  Otherwise, block it with 'none'.
        const appElement = document.querySelector( '#editor-container' )
        const setting = appSettings.get( 'application width in window' )
        appElement.style.maxWidth = setting == 'Fixed size' ? null : 'none'
    }
}

/**
 * First, install in a given TinyMCE editor the UI features for editing
 * application settings.
 * 
 * Second, install an event handler so that when the editor finishes its
 * initialization, we load the application settings and apply to the editor any
 * of them that impact its appearance.
 * 
 * @param {tinymce.Editor} editor - the editor into which to install the
 *   features
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'preferences', {
        text : 'Preferences',
        tooltip : 'Preferences',
        icon : 'preferences',
        onAction : () => {
            appSettings.load()
            appSettings.userEdit( editor ).then( applySettings )
        }
    } )
    editor.on( 'init', () => {
        appSettings.load()
        applySettings()
    } )
}

export default { appSettings, install }
