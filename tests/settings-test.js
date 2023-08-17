
// What this module DOES test:
//  - that we can import the necessary classes for testing
//  - that we can install the settings module into an editor
//  - that there is a global variable containing the app settings metadata
//  - using settings objects programmatically obeys their documented properties
// What this module DOES NOT test:
//  - the creation of a user interface from settings and/or their metadata
//  - the ability of that user interface to read from/write to storage

import { loadScript } from '../utilities.js'
import { Settings } from '../settings.js'
import { appSettings, install } from '../settings-install.js'
import {
    SettingsMetadata, SettingsCategoryMetadata, SettingMetadata,
    BoolSettingMetadata, TextSettingMetadata
} from '../settings-metadata.js'

describe( 'Settings', () => {

    it( 'Should import correct identifiers', () => {
        expect( Settings ).to.be.ok
        expect( appSettings ).to.be.ok
        expect( install ).to.be.ok
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
            const element = document.createElement( 'textarea' )
            document.body.appendChild( element )
            element.style.display = 'none'
            tinymce.init( {
                target : element,
                setup : editor => {
                    install( editor )
                    expect( editor.ui.registry.getAll().menuItems
                        .hasOwnProperty( 'preferences' ) ).to.equal( true )
                    editor.on( 'init', () => done() )
                }
            } )
        } )
    } )

    it( 'Should let us create and use a simple settings object', () => {
        // Create a small settings object with just 2 settings in its schema
        const metadata = new SettingsMetadata(
            new SettingsCategoryMetadata(
                'There is only one category',
                new BoolSettingMetadata(
                    'use emoji',
                    'Should we use emoji?',
                    true
                ),
                new TextSettingMetadata(
                    'emoji to use',
                    'Type the emoji we are allowed to use:',
                    '😀😊🤨🙁'
                )
            )
        )
        const settings = new Settings( 'Test settings', metadata )

        // The keys in the settings object are those specified in the metadata
        let keys = settings.keys()
        expect( keys ).to.be.instanceof( Array )
        expect( keys ).to.have.length( 2 )
        expect( keys ).to.include( 'use emoji' )
        expect( keys ).to.include( 'emoji to use' )
        expect( settings.has( 'use emoji' ) ).to.equal( true )
        expect( settings.has( 'emoji to use' ) ).to.equal( true )

        // Even if we were to set other values, they don't count as keys
        settings.set( 'other key', 'other value' )
        settings.set( 7, 12 )
        const anArray = [ ]
        settings.set( anArray, { 'p' : 'q' } )
        keys = settings.keys()
        expect( keys ).to.be.instanceof( Array )
        expect( keys ).to.have.length( 2 )
        expect( keys ).to.include( 'use emoji' )
        expect( keys ).to.include( 'emoji to use' )
        expect( settings.has( 'use emoji' ) ).to.equal( true )
        expect( settings.has( 'emoji to use' ) ).to.equal( true )
        expect( settings.has( 'other key' ) ).to.equal( false )
        expect( settings.has( 7 ) ).to.equal( false )
        expect( settings.has( anArray ) ).to.equal( false )

        // Querying the not-yet-set settings yields their default values
        expect( settings.get( 'use emoji' ) ).to.equal( true )
        expect( settings.get( 'emoji to use' ) ).to.equal( '😀😊🤨🙁' )

        // Querying the invalid settings yields undefined
        expect( settings.get( 'other key' ) ).to.be.undefined
        expect( settings.get( 7 ) ).to.be.undefined
        expect( settings.get( anArray ) ).to.be.undefined

        // Changing valid keys works
        settings.set( 'use emoji', false )
        settings.set( 'emoji to use', '🙂🙃' )
        expect( settings.get( 'use emoji' ) ).to.equal( false )
        expect( settings.get( 'emoji to use' ) ).to.equal( '🙂🙃' )

        // Saving and reloading retains our changes and nothing else
        settings.save()
        const settings2 = new Settings( 'second settings object', metadata )
        settings2.load()
        keys = settings2.keys()
        expect( keys ).to.be.instanceof( Array )
        expect( keys ).to.have.length( 2 )
        expect( keys ).to.include( 'use emoji' )
        expect( keys ).to.include( 'emoji to use' )
        expect( settings2.has( 'use emoji' ) ).to.equal( true )
        expect( settings2.get( 'use emoji' ) ).to.equal( false )
        expect( settings2.has( 'emoji to use' ) ).to.equal( true )
        expect( settings2.get( 'emoji to use' ) ).to.equal( '🙂🙃' )
        expect( settings2.has( 'other key' ) ).to.equal( false )
        expect( settings2.has( 7 ) ).to.equal( false )
        expect( settings2.has( anArray ) ).to.equal( false )
    } )

} )
