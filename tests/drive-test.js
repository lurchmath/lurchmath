
// What this module DOES test:
//  - that we can import the necessary classes for testing
//  - that we can install the Google Drive module into an editor
//  - that doing so installs menu items into the editor's UI registry
// What this module DOES NOT test:
//  - any user interface that may appear when loading/saving files
//  - any connection to any user's Google Drive
//  - loading file into or saving them from the editor

import { loadScript } from '../utilities.js'
import { install } from '../google-drive-ui.js'

describe( 'Google Drive integration', () => {

    it( 'Should import correct identifier', () => {
        expect( install ).to.be.ok
    } )

    it( 'Should install correctly into a TinyMCE instance', done => {
        loadScript( 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js' ).then( () => {
            tinymce.init( {
                target : document.createElement( 'textarea' ),
                setup : editor => {
                    install( editor )
                    const menuItems = editor.ui.registry.getAll().menuItems
                    expect( menuItems.hasOwnProperty( 'newlurchdocument' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'opendocument' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'savedocumentas' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'savedocument' ) ).to.equal( true )
                    setTimeout( done )
                }
            } )
        } )
    } )

} )
