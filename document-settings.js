
/**
 * This module exports one function that installs in a TinyMCE editor features
 * for editing document settings, and it also exports the metadata for Lurch
 * document settings, including fields such as title, author, date, and
 * abstract.  This metadata can be used by the {@link LurchDocument} class to
 * edit document-level settings, which are distinct from the application-level
 * settings defined in {@link module:SettingsInstaller the Settings Installer
 * module}.
 * 
 * @module DocumentSettings
 */

import {
    SettingsMetadata, SettingsCategoryMetadata,
    TextSettingMetadata, LongTextSettingMetadata
} from './settings-metadata.js'
import { LurchDocument } from './lurch-document.js'

/**
 * This metadata object can be used to create a {@link Settings} instance for
 * any given document, which can then present a UI to the user for editing the
 * document's setting (using {@link Settings#userEdit its userEdit() function}).
 * The {@link LurchDocument} class provides functionality for using this
 * metadata object in exactly that way.
 */
export const documentSettingsMetadata = new SettingsMetadata(
    new SettingsCategoryMetadata(
        'Document metadata',
        new TextSettingMetadata( 'title', 'Title', '' ),
        new TextSettingMetadata( 'author', 'Author', '' ),
        new TextSettingMetadata( 'date', 'Date', '' ),
        new LongTextSettingMetadata( 'abstract', 'Abstract', '' )
    )
)

/**
 * Installs in a given TinyMCE editor the UI features for editing document
 * settings.
 * 
 * @param {tinymce.Editor} editor - the editor into which to install the
 *   features
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'docsettings', {
        text : 'Edit document settings',
        icon : 'settings',
        tooltip : 'Edit document settings',
        onAction : () => new LurchDocument( editor ).showSettingsInterface()
    } )  
}

export default { documentSettingsMetadata, install }
