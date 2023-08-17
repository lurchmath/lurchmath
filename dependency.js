
/**
 * This file installs one tool into the user interface, a menu item for
 * inserting a dependecy-type atom into the document.  A user who edits such an
 * atom can specify a URL for importing the dependency's content.
 * 
 * Such an atom will have two important properties:
 * 
 *  * Its `"url"` metadata entry will contain the URL from which the dependency
 *    was loaded, or it will be absent if the atom has not yet been configured
 *    by the user.  This is a simple piece of metadata, not HTML-type metadata;
 *    the difference between the two is documented
 *    {@link module:Atoms.Atom#getHTMLMetadata here}.
 *  * Its `"content"` HTML metadata entry will contain the full content of the
 *    dependency that was loaded from the URL, or it will be absent if the atom
 *    has not yet been configured by the user.  This is a piece of HTML
 *    metadata, not simple metadata, because it will typically be large;
 *    the difference between the two is documented
 *    {@link module:Atoms.Atom#getHTMLMetadata here}.
 * 
 * @module Dependencies
 */

import { Atom } from './atoms.js'
import { escapeHTML } from './utilities.js'
import { loadFromURL } from './load-from-url.js'
import { LurchDocument } from './lurch-document.js'

// Internal use only.  Given a dependency-type atom, updates its body HTML code
// to correctly represent it to the user, based on whether it has a URL or not.
const updateAppearance = dependencyAtom => {
    dependencyAtom.element.style.border = 'solid 1px gray'
    dependencyAtom.element.style.padding = '0 1em 0 1em'
    const url = dependencyAtom.getMetadata( 'url' )
    dependencyAtom.fillChild( 'body',
        url ? `<p>Dependency imported from: <tt>${escapeHTML( url )}</tt></p>` :
              '<p>Click to choose URL for dependency.</p>' )
}

/**
 * Install into a TinyMCE editor instance a new menu item: Import dependency,
 * intended for the Document menu.  It adds a dependency atom (with no content
 * or URL) to the user's document, and if the user clicks it, they can then
 * specify the URL in a popup dialog.  The dialog will attempt to import a
 * document from the web using an `XMLHttpRequest` at that URL.  If that
 * succeeds, the dialog will permit the user to save that content into the
 * original dependency atom.
 * 
 * This assumes that the TinyMCE initialization code includes the "dependency"
 * item on one of the menus.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 * @function
 */
export const installDependencyMenuItem = editor => {
    editor.ui.registry.addMenuItem( 'dependency', {
        icon : 'duplicate-row',
        text : 'Import dependency',
        tooltip : 'Insert block for importing a dependency',
        onAction : () => {
            const atom = Atom.newBlock( editor, '',
                { type : 'dependency', state : 'no url' } )
            updateAppearance( atom )
            editor.insertContent( atom.getHTML() )
        }
    } )
}

// Internal use only: Show the dialog whose behavior is described above.
Atom.addType( 'dependency', clickedAtom => {
    const dialog = clickedAtom.editor.windowManager.open( {
        title : 'Choose URL for dependency',
        body : {
            type : 'panel',
            items : [
                {
                    type : 'input',
                    name : 'url',
                    label : 'Dependency URL',
                    placeholder : 'http://...'
                }
            ]
        },
        buttons : [
            {
                text : 'Download from URL',
                type : 'custom',
                name : 'download'
            },
            {
                text : 'Embed in document',
                type : 'submit',
                enabled : false,
                name : 'embed'
            },
            {
                text : 'Cancel',
                type : 'cancel',
                name : 'cancel'
            }
        ],
        onAction : ( _, details ) => {
            if ( details.name == 'download' ) {
                dialog.block( 'Attempting to download dependency...' )
                loadFromURL( dialog.getData()['url'] )
                .then( content => {
                    const parts = LurchDocument.documentParts( content )
                    dialog._lurchContent = ( parts.metadata?.innerHTML || '' )
                                         + ( parts.document?.innerHTML || '' )
                    const success = clickedAtom.editor.windowManager.open( {
                        title : 'Download successful',
                        body : {
                            type : 'panel',
                            items : [
                                {
                                    type : 'alertbanner',
                                    text : 'Dependency downloaded successfully.<br>'
                                         + 'You may now embed it into the document.',
                                    level : 'success',
                                    icon : 'duplicate-row'
                                }
                            ]
                        },
                        buttons : [ { type : 'submit', text : 'OK' } ],
                        onSubmit : () => success.close()
                    } )
                    dialog.unblock()
                    dialog.setEnabled( 'embed', true )
                } )
                .catch( _ => {
                    const failure = clickedAtom.editor.windowManager.open( {
                        title : 'Download failed',
                        body : {
                            type : 'panel',
                            items : [
                                {
                                    type : 'alertbanner',
                                    text : 'Dependency failed to download.<br>'
                                         + 'Try again or change the URL.',
                                    level : 'error',
                                    icon : 'warning'
                                }
                            ]
                        },
                        buttons : [ { type : 'submit', text : 'OK' } ],
                        onSubmit : () => failure.close()
                    } )
                    dialog.unblock()
                } )
            }
        },
        onSubmit : () => {
            clickedAtom.setMetadata( 'url', dialog.getData()['url'] )
            clickedAtom.setHTMLMetadata( 'content', dialog._lurchContent )
            updateAppearance( clickedAtom )
            dialog.close()
        }
    } )
} )
