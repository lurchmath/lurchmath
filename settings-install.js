
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
            'Example category 1',
            new NoteMetadata(
                'These are not the real application settings.  '
              + 'This is just a temporary demo.',
                'warn'
            ),
            new BoolSettingMetadata(
                'example checkbox',
                'Example boolean value',
                false
            ),
            new ColorSettingMetadata(
                'example color',
                'Example color value',
                'red'
            ),
            new ShowWarningSettingMetadata(
                'test warning',
                'Show warning before eating mushrooms',
                'I suppose it depends upon the musrooms...'
            )
        ),
        new SettingsCategoryMetadata(
            'Example category 2',
            new TextSettingMetadata(
                'example text input',
                'Example string value',
                'Henry'
            ),
            new NoteMetadata(
                'Notes of any type with basic HTML content can be inserted '
              + 'between any two settings.'
            ),
            new CategorySettingMetadata(
                'example categorical input',
                'Example element of a finite set',
                [ 'happy', 'sad', 'neither' ],
                'happy'
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
    editor.ui.registry.addButton( 'settings', {
        icon : 'preferences',
        tooltip : 'Edit application settings',
        onAction : () => {
            appSettings.load()
            appSettings.userEdit( editor ).then( changes => {
                if ( changes.length > 0 ) appSettings.save()
            } )
        }
    } )
}
