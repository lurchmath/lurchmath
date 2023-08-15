
/**
 * This module exports one function that installs in a TinyMCE editor features
 * for editing application settings, and it also exports the settings object
 * itself, for reading/writing specific settings.
 * 
 * @module SettingsInstaller
 */

import { Settings } from './settings.js'
import {
    SettingsMetadata, SettingsCategoryMetadata, BoolSettingMetadata,
    ColorSettingMetadata, CategorySettingMetadata, TextSettingMetadata,
    NoteMetadata, ShowWarningSettingMetadata
} from './settings-metadata.js'

/**
 * This is a silly example of app setting metadata for now, because we have not
 * yet defined what the actual settings for this app will be.  However, this
 * collection of settings includes one from each type of setting, and two
 * different categories, so that we can test settings dialogs now, even before
 * we have the full collection of settings we will actually show to users in the
 * Lurch app.  Later, we can replace this with the actual definition of the
 * metadata for the app's settings.
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
        )
    )
)

/**
 * Installs in a given TinyMCE editor the UI features for editing application
 * settings.
 * 
 * @param {tinymce.Editor} editor - the editor into which to install the
 *   features
 * @function
 */
export const installSettings = editor => {
    editor.ui.registry.addMenuItem( 'preferences', {
        text : 'Preferences',
        tooltip : 'Preferences',
        icon : 'preferences',
        onAction : () => {
            appSettings.load()
            appSettings.userEdit( editor ).then( changes => {
                if ( changes.length > 0 ) appSettings.save()
            } )
        }
    } )
}
