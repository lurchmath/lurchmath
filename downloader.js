
/**
 * This file installs just one tool into the user interface, a menu item for
 * downloading the current Lurch document to the user's computer.
 * 
 * @module Downloader
 */

import { LurchDocument } from './lurch-document.js'

/**
 * Install into a TinyMCE editor instance one new menu item: Download, intended
 * for the File menu.  This menu item allows the user to download the current
 * Lurch document to their computer, assuming that the TinyMCE initialization
 * code includes the "download" item on one of the menus.
 * 
 * @param {tinymce.Editor} editor the TinyMCE editor instance into which the new
 *   menu item should be installed
 */
export const installDownloader = editor => {
    editor.ui.registry.addMenuItem( 'download', {
        text : 'Download',
        icon : 'export',
        tooltip : 'Download document',
        onAction : () => {
            const content = new LurchDocument( editor ).getDocument()
            const anchor = document.createElement( 'a' )
            anchor.setAttribute( 'href', 'data:text/html;charset=utf-8,'
                + encodeURIComponent( content ) ) 
            anchor.setAttribute( 'download', 'lurch-document.html' )
            document.body.appendChild( anchor )
            anchor.click()
            anchor.remove()
        }
    } )
}
