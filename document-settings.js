
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

import { Settings } from './settings.js'
import {
    SettingsMetadata, SettingsCategoryMetadata,
    TextSettingMetadata, LongTextSettingMetadata
} from './settings-metadata.js'
import { LurchDocument } from './lurch-document.js'

/**
 * This metadata object can be used to create a {@link Settings} instance for
 * any given document, which can then present a UI to the user for editing the
 * document's setting (using {@link Settings#userEdit its userEdit() function}).
 * We use it for this purpose in the menu item we create in the
 * {@link module:DocumentSettings.install install()} function.
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
 * settings.  Specifically, we add a menu item called `"docsettings"` that is
 * intended for the Document menu, and which does the following:
 * 
 *  * Pop up a user interface allowing the user to edit the document's settings.
 *  * Populate that user interface with the existing values of the settings
 *    stored in the document's metadata.
 *  * If the user accepts any changes they've made to the settings before
 *    closing the dialog, save those changes back into the document's metadata
 *    as well.
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
        onAction : () => {
            // Create settings instance and LurchDocument instance
            const settings = new Settings( 'Document settings',
                documentSettingsMetadata )
            const LDoc = new LurchDocument( editor )
            // Load document settings into it
            const allowedKeys = settings.keys()
            LDoc.getMetadataKeys( 'settings' ).forEach( key => {
                if ( allowedKeys.includes( key ) ) {
                    const metadata = settings.metadata.metadataFor( key )
                    const loaded = LDoc.getMetadata( 'settings', key )
                    settings.set( key,
                        metadata ? metadata.convert( loaded ) : loaded )
                }
            } )
            // Present interface to user
            settings.userEdit( this.editor )
            // Save iff the user accepted the changes
            .then( changedKeys => changedKeys.forEach( key =>
                LDoc.setMetadata( 'settings', key, 'json',
                    settings.get( key ) ) ) )
        }
    } )  
}

export default { documentSettingsMetadata, install }
