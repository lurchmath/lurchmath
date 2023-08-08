
import { loadScript } from '../utilities.js'
import { installDrive } from '../google-drive-ui.js'

describe( 'Google Drive integration', () => {

    it( 'Should import correct identifier', () => {
        expect( installDrive ).to.be.ok
    } )

    it( 'Should install correctly into a TinyMCE instance', done => {
        loadScript( 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js' ).then( () => {
            tinymce.init( {
                target : document.createElement( 'textarea' ),
                setup : editor => {
                    installDrive( editor )
                    const menuItems = editor.ui.registry.getAll().menuItems
                    expect( menuItems.hasOwnProperty( 'newlurchdocument' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'opendocument' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'savedocumentas' ) ).to.equal( true )
                    expect( menuItems.hasOwnProperty( 'savedocument' ) ).to.equal( true )
                    setTimeout( done, 0 )
                }
            } )
        } )
    } )

} )
