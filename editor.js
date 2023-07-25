
import { loadScript } from './utilities.js'

const TinyMCEURL = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.6.0/tinymce.min.js'

loadScript( TinyMCEURL ).then( () => {
    tinymce.init( {
        selector : '#editor',
        promotion : false,
        toolbar : 'undo redo | styles bold italic | alignleft aligncenter alignright outdent indent',
        plugins : 'fullscreen',
        statusbar : false,
        setup : editor => {
            editor.on( 'init', () => editor.execCommand( 'mceFullScreen' ) )
        }
    } )
} )
