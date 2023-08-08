
// What this module DOES test:
//  - that we can import the necessary classes for testing
//  - that we can install the settings module into an editor
//  - that there is a global variable containing the app settings metadata
// What this module DOES NOT test:
//  - the creation of a user interface from settings and/or their metadata
//  - the ability of that user interface to read from/write to storage

import { loadScript } from '../utilities.js'
import { appSettings, installSettings } from '../settings-install.js'
import {
    SettingsMetadata, SettingsCategoryMetadata, SettingMetadata
} from '../settings-metadata.js'

describe( 'Settings', () => {

    it( 'Should import correct identifiers', () => {
        expect( appSettings ).to.be.ok
        expect( installSettings ).to.be.ok
        expect( SettingMetadata ).to.be.ok
        expect( SettingsCategoryMetadata ).to.be.ok
        expect( SettingsMetadata ).to.be.ok
    } )

    it( 'Should have application settings with the right structure', () => {
        // appSettings is an object with a string name
        expect( appSettings ).to.be.instanceof( Object )
        expect( typeof appSettings.name ).to.equal( 'string' )
        // its metadata member is an instance of SettingsMetadata
        expect( appSettings.metadata ).to.be.instanceof( SettingsMetadata )
        expect( appSettings.metadata.categories ).to.be.instanceof( Array )
        // every category is an instance of SettingsCategoryMetadata
        expect( appSettings.metadata.categories.every( category =>
            category instanceof SettingsCategoryMetadata ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.hasOwnProperty( 'name' ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            typeof category.name == 'string' ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.hasOwnProperty( 'contents' ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents instanceof Array ) ).to.equal( true )
        // everything in a category's contents array is all individual settings
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                entry instanceof SettingMetadata ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'name' ) ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.name == 'string'
             || typeof entry.name == 'undefined' ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'label' ) ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.label == 'string'
             || typeof entry.label == 'undefined' ) ) ).to.equal( true )
        expect( appSettings.metadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'defaultValue' ) ) ) ).to.equal( true )
    } )

    it( 'Should install correctly into a TinyMCE instance', done => {
        loadScript( 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js' ).then( () => {
            tinymce.init( {
                target : document.createElement( 'textarea' ),
                setup : editor => {
                    installSettings( editor )
                    expect( editor.ui.registry.getAll().buttons
                        .hasOwnProperty( 'settings' ) ).to.equal( true )
                    setTimeout( done, 0 )
                }
            } )
        } )
    } )

} )
