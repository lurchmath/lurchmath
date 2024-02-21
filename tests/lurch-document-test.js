
import { loadScript } from '../utilities.js'
import { LurchDocument } from '../lurch-document.js'
import {
    SettingMetadata, SettingsMetadata, SettingsCategoryMetadata
} from '../settings-metadata.js'

describe( 'Lurch Document interface', () => {

    let editor
    before( done => {
        loadScript( 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js' ).then( () => {
            const element = document.createElement( 'textarea' )
            document.body.appendChild( element )
            element.style.display = 'none'
            tinymce.init( {
                target : element,
                setup : e => {
                    editor = e
                    editor.on( 'init', () => done() )
                }
            } )
        } )
    } )

    it( 'Should import correct identifier', () => {
        expect( LurchDocument ).to.be.ok
    } )

    it( 'Should correctly set up a TinyMCE editor for testing', () => {
        expect( editor ).to.be.ok
        expect( editor.getContent ).to.be.ok // primitive check to see if it...
        expect( editor.setContent ).to.be.ok // ...looks like a TinyMCE editor
    } )

    it( 'Should let us construct instances for a TinyMCE editor', () => {
        let LDoc1, LDoc2
        expect( () => {
            LDoc1 = new LurchDocument( editor )
            LDoc2 = new LurchDocument( editor )
        } ).not.to.throw()
        expect( LDoc1 ).not.to.equal( LDoc2 )
    } )

    it( 'Should have doc settings metadata with the right structure', () => {
        // it is an instance of SettingsMetadata
        expect( LurchDocument.settingsMetadata ).to.be.instanceof( SettingsMetadata )
        expect( LurchDocument.settingsMetadata.categories ).to.be.instanceof( Array )
        // every category is an instance of SettingsCategoryMetadata
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category instanceof SettingsCategoryMetadata ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.hasOwnProperty( 'name' ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            typeof category.name == 'string' ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.hasOwnProperty( 'contents' ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents instanceof Array ) ).to.equal( true )
        // everything in a category's contents array is all individual settings
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry instanceof SettingMetadata ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'name' ) ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.name == 'string'
             || typeof entry.name == 'undefined' ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'label' ) ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                typeof entry.label == 'string'
             || typeof entry.label == 'undefined' ) ) ).to.equal( true )
        expect( LurchDocument.settingsMetadata.categories.every( category =>
            category.contents.every( entry =>
                entry.hasOwnProperty( 'defaultValue' ) ) ) ).to.equal( true )
    } )

    it( 'Should let us clear editor contents and metadata', () => {
        // first, put some content into the editor
        const LDoc = new LurchDocument( editor )
        editor.setContent( '<p>A paragraph.</p>' )
        LDoc.setMetadata( 'example', 'key', 'json', 'value' )
        expect( editor.getContent() ).to.equal( '<p>A paragraph.</p>' )
        expect( LDoc.getMetadata( 'example', 'key' ) ).to.equal( 'value' )
        // now clear it and make sure it's gone
        LDoc.newDocument()
        expect( editor.getContent() ).to.equal( '' )
        expect( LDoc.getMetadata( 'example', 'key' ) ).to.be.undefined
    } )

    it( 'Should let us change and query contents and metadata', () => {
        // set editor content and a bunch of metadata
        const LDoc = new LurchDocument( editor )
        const docHTML = '<p>One</p>\n<p><strong>Two</strong></p>\n<p>Three</p>'
        editor.setContent( docHTML )
        LDoc.setMetadata( 'styles', 'paragraph', 'json',
            { margin : '10px', border : 'solid 1px blue' } )
        LDoc.setMetadata( 'styles', 'anchor', 'json',
            { textDecoration : 'underline', color : 'blue' } )
        LDoc.setMetadata( 'behaviors', 'autosave delay', 'json', 10 )
        LDoc.setMetadata( 'snippets', 'hello world', 'html', '<p>HELLO!</p>' )

        // test the querying of: contents, metadata values, categories, keys
        expect( editor.getContent() ).to.equal( docHTML )
        expect( LDoc.getMetadata( 'styles', 'paragraph' ) ).to.eql(
            { margin : '10px', border : 'solid 1px blue' } )
        expect( LDoc.getMetadata( 'styles', 'anchor' ) ).to.eql(
            { textDecoration : 'underline', color : 'blue' } )
        expect( LDoc.getMetadata( 'behaviors', 'autosave delay' ) ).to.eql( 10 )
        const elt = LDoc.getMetadata( 'snippets', 'hello world' )
        expect( elt.tagName ).to.equal( 'DIV' )
        expect( elt.innerHTML ).to.equal( '<p>HELLO!</p>' )
        const cats = LDoc.getMetadataCategories()
        expect( cats ).to.be.instanceof( Array )
        expect( cats.length ).to.equal( 3 )
        expect( cats ).to.include( 'styles' )
        expect( cats ).to.include( 'behaviors' )
        expect( cats ).to.include( 'snippets' )
        const keys = LDoc.getMetadataKeys( 'styles' )
        expect( keys.length ).to.equal( 2 )
        expect( keys ).to.include( 'paragraph' )
        expect( keys ).to.include( 'anchor' )
        expect( LDoc.getMetadataKeys( 'behaviors' ) )
            .to.eql( [ 'autosave delay' ] )
        expect( LDoc.getMetadataKeys( 'snippets' ) )
            .to.eql( [ 'hello world' ] )

        // test the deletion of metadata and then querying again
        LDoc.deleteMetadata( 'styles', 'anchor' )
        LDoc.deleteMetadata( 'behaviors', 'autosave delay' )
        LDoc.deleteMetadata( 'not a real', 'thing!' )
        expect( editor.getContent() ).to.equal( docHTML )
        expect( LDoc.getMetadata( 'styles', 'paragraph' ) ).to.eql(
            { margin : '10px', border : 'solid 1px blue' } )
        expect( LDoc.getMetadata( 'snippets', 'hello world' ).outerHTML )
            .to.equal( elt.outerHTML )
        const cats2 = LDoc.getMetadataCategories()
        expect( cats2 ).to.be.instanceof( Array )
        expect( cats2.length ).to.equal( 2 )
        expect( cats2 ).to.include( 'styles' )
        expect( cats2 ).to.include( 'snippets' )
        expect( LDoc.getMetadataKeys( 'styles' ) )
            .to.eql( [ 'paragraph' ] )
        expect( LDoc.getMetadataKeys( 'behaviors' ) )
            .to.eql( [ ] )
        expect( LDoc.getMetadataKeys( 'snippets' ) )
            .to.eql( [ 'hello world' ] )
    } )

    it( 'Should let us fetch HTML for document and metadata together', () => {
        // Get the contents and metadata together in one big HTML string:
        const LDoc = new LurchDocument( editor )
        const encoded = LDoc.getDocument()
        const docContent = editor.getContent()
        expect( encoded.search( docContent ) ).to.be.above( -1 )
        expect( encoded.length ).to.be.above( docContent.length )

        // Now let's clear everything out so we can test restoring that data
        LDoc.newDocument()
        expect( editor.getContent() ).to.equal( '' )
        expect( LDoc.getMetadataCategories() ).to.eql( [ ] )
        expect( LDoc.getMetadataKeys( 'styles' ) ).to.eql( [ ] )
        expect( LDoc.getMetadataKeys( 'behaviors' ) ).to.eql( [ ] )
        expect( LDoc.getMetadataKeys( 'snippets' ) ).to.eql( [ ] )
        expect( LDoc.getMetadata( 'styles', 'paragraph' ) ).to.be.undefined
        expect( LDoc.getMetadata( 'styles', 'anchor' ) ).to.be.undefined
        expect( LDoc.getMetadata( 'behaviors', 'autosave delay' ) ).to.be.undefined
        expect( LDoc.getMetadata( 'snippets', 'hello world' ) ).to.be.undefined

        // Now reload everything from the encoding and test it
        LDoc.setDocument( encoded )
        expect( editor.getContent() ).to.equal(
            '<p>One</p>\n<p><strong>Two</strong></p>\n<p>Three</p>' )
        expect( LDoc.getMetadata( 'styles', 'paragraph' ) ).to.eql(
            { margin : '10px', border : 'solid 1px blue' } )
        expect( LDoc.getMetadata( 'snippets', 'hello world' ).innerHTML )
            .to.equal( '<p>HELLO!</p>' )
        const cats = LDoc.getMetadataCategories()
        expect( cats ).to.be.instanceof( Array )
        expect( cats.length ).to.equal( 2 )
        expect( cats ).to.include( 'styles' )
        expect( cats ).to.include( 'snippets' )
        expect( LDoc.getMetadataKeys( 'styles' ) )
            .to.eql( [ 'paragraph' ] )
        expect( LDoc.getMetadataKeys( 'behaviors' ) )
            .to.eql( [ ] )
        expect( LDoc.getMetadataKeys( 'snippets' ) )
            .to.eql( [ 'hello world' ] )
    } )

} )
