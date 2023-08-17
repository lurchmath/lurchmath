
// What this module DOES test:
//  - that we can import the necessary classes for testing
//  - that we can install the document settings module into an editor
//  - that there is a global variable containing the doc settings metadata
// What this module DOES NOT test:
//  - the creation of a user interface from settings and/or their metadata
//  - the ability of that user interface to read from/write to document metadata

import { loadScript } from '../utilities.js'
import {
    SettingMetadata, SettingsMetadata, SettingsCategoryMetadata
} from '../settings-metadata.js'
import { documentSettingsMetadata, install } from '../document-settings.js'

describe( 'Document Settings', () => {

    it( 'Should import correct identifiers', () => {
        expect( documentSettingsMetadata ).to.be.ok
        expect( install ).to.be.ok
    } )

    it( 'Should have doc settings metadata with the right structure', () => {
        // it is an instance of SettingsMetadata
        expect( documentSettingsMetadata ).to.be.instanceof( SettingsMetadata )
        expect( documentSettingsMetadata.categories ).to.be.instanceof( Array )
        // every category is an instance of SettingsCategoryMetadata
        expect( documentSettingsMetadata.categories.every( category =>
            category instanceof SettingsCategoryMetadata ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.hasOwnProperty( 'name' ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            typeof category.name == 'string' ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.hasOwnProperty( 'contents' ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents instanceof Array ) ).to.equal( true )
        // everything in a category's contents array is all individual settings
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry instanceof SettingMetadata ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'name' ) ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.name == 'string'
             || typeof entry.name == 'undefined' ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'label' ) ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.label == 'string'
             || typeof entry.label == 'undefined' ) ) ).to.equal( true )
        expect( documentSettingsMetadata.categories.every( category =>
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
                        .hasOwnProperty( 'docsettings' ) ).to.equal( true )
                    editor.on( 'init', () => done() )
                }
            } )
        } )
    } )

} )
