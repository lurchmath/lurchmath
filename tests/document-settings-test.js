
// What this module DOES test:
//  - that we can import the necessary classes for testing
//  - that we can install the document settings module into an editor
//  - that there is a global variable containing the doc settings metadata
// What this module DOES NOT test:
//  - the creation of a user interface from settings and/or their metadata
//  - the ability of that user interface to read from/write to document metadata

import { loadScript } from '../utilities.js'
import { install } from '../document-settings.js'

describe( 'Document Settings', () => {

    it( 'Should import correct identifiers', () => {
        expect( install ).to.be.ok
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
