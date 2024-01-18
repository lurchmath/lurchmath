
import { ChooseLocalFileItem, saveAs } from './local-storage-drive.js'
import { UploadItem, downloadFile } from './upload-download.js'
import { ImportFromURLItem, loadFromURL } from './load-from-url.js'
import { appSettings } from './settings-install.js'
import { appURL, isValidURL } from './utilities.js'
import { LurchDocument } from './lurch-document.js'

/**
 * This class makes it easier to create and use TinyMCE dialogs that have
 * components that work well with Lurch.  It handles a lot of the boilerplate
 * code that TinyMCE demands and it allows us to work in a more object-oriented
 * way, rather than passing around large pieces of JSON and writing all of a
 * dialog's code in one big function call.
 */
export class Dialog {

    /**
     * Create (but do not yet show) a dialog box associated with a given editor.
     * 
     * @param {string} title - the title to display at the top of the dialog
     * @param {tinymce.Editor} editor - the editor in which to create the dialog
     */
    constructor ( title, editor ) {
        this.editor = editor
        this.json = {
            title,
            body : {
                type : 'panel',
                items : [ ]
            },
            buttons : [
                {
                    name : 'OK',
                    text : 'OK',
                    type : 'submit',
                    buttonType : 'primary'
                },
                {
                    name : 'Cancel',
                    text : 'Cancel',
                    type : 'cancel'
                }
            ],
            onChange : ( ...args ) => this.onChange?.( ...args ),
            onAction : ( ...args ) => {
                this.items.forEach( item => item.onAction?.( ...args ) )
            },
            onSubmit : () => {
                this.dialog?.close()
                this.resolver?.( true )
            },
            onCancel : () => {
                this.dialog?.close()
                this.resolver?.( false )
            },
            onTabChange : ( _, details ) => {
                this.currentTabName = details.newTabName
                this.runItemShowHandlers()
            }
        }
        this.dialog = null
        this.currentTabName = null
        this.items = [ ]
        this.focusItem = null
        this.hideHeader = false
        this.hideFooter = false
    }

    /**
     * Close this dialog box and resolve any open promise with a "false"
     * argument, as if the user had canceled the dialog.
     */
    close () {
        this.dialog?.close()
        this.resolver?.( false )
    }

    /**
     * TinyMCE dialogs allow you to specify any set of buttons for the dialog's
     * footer.  By default, every dialog this class displays will have an OK
     * button for submitting the dialog and a Cancel button for canceling it.
     * You can replace those buttons by calling this function, passing an array
     * of JSON objects, one for each button you wish to define.
     * 
     * For example, to use just an OK button, you might do the following
     * (although you could accomplish it more easily with
     * {@link Dialog#removeButton removeButton()} instead).
     * 
     * ```js
     * myDialog.setButtons( [
     *     { text : 'OK', type : 'submit', buttonType : 'primary' }
     * ] )
     * ```
     * 
     * @param  {any[]} buttons - the JSON code for the buttons in the dialog's
     *   footer
     * @see {@link Dialog#removeButton removeButton()}
     */
    setButtons ( ...buttons ) {
        this.json.buttons = buttons
    }

    /**
     * Remove one of the buttons in this dialog.  Especially useful if the
     * dialog is for informational purposes only, and doesn't need a "cancel"
     * button.  You could call `myDialog.removeButton( 'Cancel' )`.
     * 
     * @param {string} text - the text shown on the button to be removed
     * @see {@link Dialog#setButtons setButtons()}
     */
    removeButton ( text ) {
        this.json.buttons = this.json.buttons.filter(
            button => button.text != text )
    }

    /**
     * If you want to keep a submit button but not have it named with its
     * default text of "OK" you can use this function to rename that default
     * button.  It will still function as a submit button.
     * 
     * @param {string} text - the new text to use in place of "OK"
     */
    setOK ( text ) {
        const button = this.json.buttons.find( button =>
            button.type == 'submit' && button.buttonType == 'primary' )
        if ( button ) button.text = text
    }

    /**
     * Any TinyMCE dialog can have an object mapping control IDs to values, to
     * fill the dialog's input controls with their initial values.  To specify
     * that mapping, use this function.  Its keys should be the names of any
     * input controls you've added to this dialog using
     * {@link Dialog#addItem addItem()}.
     * 
     * @param {Object} data - the mapping from control names to values
     */
    setInitialData ( data ) {
        this.json.initialData = data
    }

    /**
     * Dialogs are not, by default, split into tabs, but are just one large
     * panel of controls.  You can split them into a set of tabs by calling
     * this function and providing the names of the tabs you want created.
     * 
     * @param  {string[]} titles - the titles of the tabs
     * @see {@link Dialog#currentTabTitle currentTabTitle()}
     * @see {@link Dialog#showTab showTab()}
     * @see {@link Dialog#removeTabs removeTabs()}
     */
    setTabs ( ...titles ) {
        this.json.body = {
            type : 'tabpanel',
            tabs : titles.map( title => {
                return {
                    name : title.replace( /[^a-zA-Z]/g, '' ),
                    title : title,
                    items : [ ]
                }
            } )
        }
    }

    /**
     * This is the reverse operation of {@link Dialog#setTabs setTabs()}.  It
     * removes all tabs, thus collapsing all items onto one pane of the dialog.
     * This is almost never needed, because you typically set up a dialog once,
     * then use it, and don't need to change its structure in this way.
     * 
     * @see {@link Dialog#setTabs setTabs()}
     */
    removeTabs () {
        this.json.body = { type : 'panel', items : [ ] }
    }

    /**
     * If you have split your dialog into tabs using the {@link Dialog#setTabs
     * setTabs()} function, and shown your dialog, this function will report the
     * title shown on the top of the currently visible tab.
     * 
     * @returns {string} the title of the currently shown tab
     * @see {@link Dialog#setTabs setTabs()}
     * @see {@link Dialog#showTab showTab()}
     */
    currentTabTitle () {
        const n = this.json.body.tabs ? this.json.body.tabs.length : 0
        for ( let i = 0 ; i < n ; i++ )
            if ( this.json.body.tabs[i].name == this.currentTabName )
                return this.json.body.tabs[i].title
    }

    /**
     * If you have split your dialog into tabs using the {@link Dialog#setTabs
     * setTabs()} function, and shown your dialog, you can call this function to
     * change which tab is visible, specifying the new one to show by its title.
     * 
     * @param {string} title - the title of the tab you want to switch to
     */
    showTab ( title ) {
        const n = this.json.body.tabs ? this.json.body.tabs.length : 0
        for ( let i = 0 ; i < n ; i++ )
            if ( this.json.body.tabs[i].title == title )
                return this.dialog.showTab( this.json.body.tabs[i].name )
    }

    /**
     * Add an item to the dialog.  There is not a specific class defined for
     * dialog items, because they need provide only a `.json()` method that
     * creates the JSON code for all the body components the item adds to the
     * dialog.  However, items can optionally also provide `.onAction()` and
     * `.onShow()` event handlers, as well as a `.get()` event that can be more
     * flexible than `dialog.getData()['arg']`.
     * 
     * @param {Object} item - the item to add, any object that has a `.json()`
     *   method that creates JSON code appropriate for TinyMCE dialogs
     * @param {string} tabTitle - the tab into which to insert the item, if the
     *   dialog is split into tabs; leave this blank if it is not
     * @see {@link AlertItem}
     * @see {@link HTMLItem}
     * @see {@link TextInputItem}
     * @see {@link ButtonItem}
     * @see {@link ImportFromURLItem}
     * @see {@link ChooseLocalFileItem}
     * @see {@link UploadItem}
     * @see {@link SelectBoxItem}
     * @see {@link Dialog#removeItem removeItem()}
     */
    addItem ( item, tabTitle = null ) {
        if ( !this.items.includes( item ) ) {
            this.items.push( item )
            item.dialog = this
        }
        item._generated_json = item.json()
        if ( !tabTitle )
            return item._generated_json.forEach(
                item => this.json.body.items.push( item ) )
        const tab = this.json.body.tabs.find( tab => tab.title == tabTitle )
        if ( !tab )
            throw new Error( `Invalid tab: ${tabTitle}` )
        item.tab = tab.name
        item._generated_json.forEach( item => tab.items.push( item ) )
    }

    /**
     * Remove an item from the dialog, and also remove from the dialog's
     * internal JSON data structure any JSON items created from the item that
     * is being removed.
     * 
     * @param {integer} index - the index of the item to remove
     * @see {@link Dialog#addItem addItem()}
     */
    removeItem ( index ) {
        if ( this.json.body.tabs ) {
            const tab = this.json.body.tabs.find(
                tab => tab.name == this.items[index].tab )
            tab.items = tab.items.filter( item =>
                !this.items[index]._generated_json.includes( item ) )
        } else {
            this.json.body.items = this.json.body.items.filter( item =>
                !this.items[index]._generated_json.includes( item ) )
        }
        this.items.splice( index, 1 )
    }

    /**
     * Show the dialog, run any `.onShow()` event handlers in any items in the
     * dialog, and return a promise.  That promise resolves when the user
     * submits or cancels the dialog, and returns true if it was a submit and
     * false if it was a cancel.
     * 
     * @returns {Promise} a promise that resolves when the dialog closes or
     *   encounters an error
     */
    show () {
        if ( this.json.body.tabs )
            this.currentTabName = this.json.body.tabs[0].name
        this.dialog = this.editor.windowManager.open( this.json )
        this.element = Dialog.getTopDialogElement()
        if ( this.hideHeader )
            this.querySelector( '.tox-dialog__header' ).style.display = 'none'
        if ( this.hideFooter )
            this.querySelector( '.tox-dialog__footer' ).style.display = 'none'
        return new Promise( ( resolve, reject ) => {
            this.resolver = resolve
            this.rejecter = reject
            this.runItemShowHandlers()
        } ).finally( () => {
            delete this.element
        } )
    }

    /**
     * Specify which control should receive focus when the dialog is first
     * shown.  You can pass `null` to clear this setting.
     * 
     * @param {string} name - the name of the control to focus when the dialog
     *   is shown
     */
    setDefaultFocus ( name ) { this.focusItem = name }

    // For internal use only; see show().
    runItemShowHandlers () {
        if ( this.json.body.tabs )
            this.items.forEach( item => {
                if ( item.tab == this.currentTabName )
                    item.onShow?.( this.dialog )
            } )
        else
            this.items.forEach( item => item.onShow?.( this.dialog ) )
        if ( this.focusItem )
            setTimeout( () => this.dialog.focus( this.focusItem ) )
    }

    /**
     * This is similar to TinyMCE's `dialog.getData()[key]` syntax, but more
     * flexible in that before resorting to that fallback method, it first asks
     * each item in the dialog if it wants to return a value for the given key.
     * This lets those items behave in a more sophisticated and flexible manner
     * if they choose to.  If none of them returns a value different from
     * `undefined`, then we fall back on the standard TinyMCE method shown
     * above.  If the dialog is not shown, this returns undefined.
     * 
     * @param {string} key - the key whose value should be looked up
     * @returns {any} the corresponding value
     */
    get ( key ) {
        if ( !this.dialog ) return undefined
        const data = this.dialog.getData()
        for ( let i = 0 ; i < this.items.length ; i++ ) {
            if ( !this.items[i].get ) continue
            const maybe = this.items[i].get( key, data )
            if ( maybe !== undefined ) return maybe
        }
        return data[key]
    }

    /**
     * Ask TinyMCE to regenerate the dialog's content from its JSON encoding.
     */
    reload () {
        this.dialog?.redial( this.json )
        this.runItemShowHandlers()
    }

    /**
     * Behaves exactly like `document.querySelector()`, except that it is run on
     * just the element representing this dialog box, and thus will return only
     * an element that appears in this dialog.  Or, if this dialog has no
     * element matching the given selector, it returns undefined.
     * 
     * @param {string} selector - the CSS selector to use for the query
     * @returns {HTMLElement} the first element that matches the selector
     * @see {@link Dialog#querySelectorAll querySelectorAll()}
     * @see {@link Dialog.getTopDialogElement getTopDialogElement()}
     */
    querySelector ( selector ) {
        return this.element?.querySelector( selector )
    }

    /**
     * Behaves exactly like `document.querySelectorAll()`, except that it is run
     * on just the element representing this dialog box, and thus will return
     * only elements that appear in this dialog.  Or, if this dialog has no
     * element matching the given selector, it returns an empty node list.
     * 
     * @param {string} selector - the CSS selector to use for the query
     * @returns {NodeList} the list of elements that match the selector
     * @see {@link Dialog#querySelector querySelector()}
     * @see {@link Dialog.getTopDialogElement getTopDialogElement()}
     */
    querySelectorAll ( selector ) {
        return this.element?.querySelectorAll( selector )
    }

    /**
     * TinyMCE may have open zero or more dialog boxes at any given time.  This
     * method returns the HTML element (a DIV) corresponding to the topmost
     * dialog box, or undefined if there are no open dialogs.
     * 
     * Whenever an instance of this class is placed on screen using its
     * {@link Dialog#show show()} method, this method is used to notice which
     * DOM element represents that dialog, and it is stored in the dialog's
     * `element` field for later use by functions like
     * {@link Dialog#querySelector querySelector()} and
     * {@link Dialog#querySelectorAll querySelectorAll()}.
     * 
     * @returns {HTMLDivElement} the DIV element in the DOM representing the
     *   topmost TinyMCE dialog
     */
    static getTopDialogElement () {
        const allDialogElements =
            document.querySelectorAll( 'div.tox-dialog[role="dialog"]' )
        return allDialogElements[allDialogElements.length - 1]
    }

    /**
     * A static method that creates a dialog with just an OK button and a
     * success message in it.  This is a convenience method that makes it
     * possible to show a success message in a modal dialog using just one line
     * of code.
     * 
     * @param {tinymce.Editor} editor - the editor over which to show the dialog
     * @param {string} text - the success message to be displayed
     * @param {string} [title="Success"] - an optional title for the dialog
     * @returns {Promise} a promise that resolves when the dialog closes, the
     *   result of a call to {@link Dialog#show show()}
     * @see {@link Dialog.failure Dialog.failure()}
     * @see {@link Dialog.areYouSure Dialog.areYouSure()}
     */
    static success ( editor, text, title = 'Success' ) {
        const dialog = new Dialog( title, editor )
        dialog.removeButton( 'Cancel' )
        dialog.addItem( new AlertItem( 'success', text ) )
        return dialog.show()
    }

    /**
     * A static method that creates a dialog with just an OK button and a
     * failure message in it.  This is a convenience method that makes it
     * possible to show a failure message in a modal dialog using just one line
     * of code.
     * 
     * @param {tinymce.Editor} editor - the editor over which to show the dialog
     * @param {string} text - the failure message to be displayed
     * @param {string} [title="Failure"] - an optional title for the dialog
     * @returns {Promise} a promise that resolves when the dialog closes, the
     *   result of a call to {@link Dialog#show show()}
     * @see {@link Dialog.success Dialog.success()}
     * @see {@link Dialog.areYouSure Dialog.areYouSure()}
     */
    static failure ( editor, text, title = 'Failure' ) {
        const dialog = new Dialog( title, editor )
        dialog.removeButton( 'Cancel' )
        dialog.addItem( new AlertItem( 'error', text ) )
        return dialog.show()
    }

    /**
     * A static method that creates a dialog entitled "Are you sure?" and
     * prompting the user with a warning containing the given text.  The return
     * value is a promise that resolves with a boolean argument indicating
     * whether the user clicked yes/I'm sure (true) or no/Cancel (false).
     * 
     * @param {tinymce.Editor} editor - the editor over which to show the dialog
     * @param {string} text - the question to be displayed
     * @returns {Promise} a promise that resolves when the dialog closes, the
     *   result of a call to {@link Dialog#show show()}
     * @see {@link Dialog.success Dialog.success()}
     * @see {@link Dialog.failure Dialog.failure()}
     */
    static areYouSure ( editor, text ) {
        const dialog = new Dialog( 'Are you sure?', editor )
        dialog.addItem( new AlertItem( 'warn', text ) )
        dialog.setOK( 'I\'m sure' )
        return dialog.show()
    }

    /**
     * This static function shows a dialog for loading a file.  The dialog
     * contains three tabs, one for loading a file from browser storage, one for
     * letting the user upload from their computer, and one for letting the user
     * import a file from a web URL.  The user can choose their preferred method
     * and import the file.
     * 
     * The function returns a promise that resolves when the user closes the
     * dialog.  If the user canceled and did not choose or accept a file, the
     * handler will be passed no arguments.  If the user did choose and accept a
     * file, the argument passed to the handler will be an object with two
     * fields, of the form `{ filename : '...', content : '...' }`, where the
     * filename will be the filename or URL and the content will be the entirety
     * of the file's content, which may be large.  Both are strings.
     * 
     * @param {tinymce.Editor} editor - the editor instance in which to display
     *   the dialog
     * @param {string} [title="File"] - the title to show at the top of the dialog
     * @returns {Promise} a promise that resolves to the file information as
     *   specified above, or rejects if an error occurs
     * @see {@link Dialog.saveFile Dialog.saveFile()}
     */
    static loadFile ( editor, title = 'File' ) {
        const dialog = new Dialog( title, editor )
        dialog.json.size = 'medium'
        const tabNames = editor.appOptions.fileOpenTabs || [
            'From browser storage', 'From your computer', 'From the web'
        ]
        dialog.setTabs( ...tabNames )
        if ( tabNames.includes( 'From browser storage' ) )
            dialog.addItem( new ChooseLocalFileItem( 'localFile' ), 'From browser storage' )
        if ( tabNames.includes( 'From your computer' ) )
            dialog.addItem( new UploadItem( 'uploadedFile' ), 'From your computer' )
        if ( tabNames.includes( 'From the web' ) )
            dialog.addItem( new ImportFromURLItem( 'importedFile' ), 'From the web' )
        return new Promise( ( resolve, reject ) => {
            dialog.show().then( userHitOK => {
                if ( !userHitOK ) return resolve()
                const title = dialog.currentTabTitle()
                if ( title == 'From browser storage' ) {
                    resolve( dialog.get( 'localFile' ) )
                } else if ( title == 'From your computer' ) {
                    resolve( dialog.get( 'uploadedFile' ) )
                } else if ( title == 'From the web' ) {
                    // If the URL is relative, make it absolute, so that it's clearly
                    // a URL and not later mistaken as a filename in localStorage.
                    const url = new URL(
                        dialog.get( 'importedFile' ), appURL()
                    ).href
                    // Now proceed to load.
                    loadFromURL( url )
                    .then( content => {
                        resolve( {
                            filename : url,
                            content : content
                        } )
                    } ).catch( () => {
                        Dialog.notify( editor, 'error',
                            `Error importing document from ${url}.<br>
                            (Not all servers permit downloads from other domains.)` )
                        reject( 'Could not download from URL.' )
                    } )
                } else {
                    reject( 'Unknown tab: ' + title )
                }
            } ).catch( reject )
            setTimeout( () => {
                const defaultTab = appSettings.get( 'default open dialog tab' )
                if ( tabNames.includes( defaultTab ) )
                    dialog.showTab( defaultTab )
            } )
        } )
    }

    /**
     * This static function shows a dialog for saving a file.  The dialog
     * contains two tabs, one for saving a file to browser storage and one for
     * letting the user download to their computer.  The user can choose their
     * preferred method and save the file.
     * 
     * The function returns a promise that resolves when the user closes the
     * dialog.  If the user canceled and did not choose or accept a file, the
     * handler will be passed a boolean false.  If the downloaded the file, the
     * handler will be passed a boolean true.  If the user saved the file to the
     * browser's local storage, the handler will be passed a string containing
     * the chosen filename.
     * 
     * @param {tinymce.Editor} editor - the editor instance in which to display
     *   the dialog
     * @param {string} [title="File"] - the title to show at the top of the dialog
     * @returns {Promise} a promise that resolves as specified above, or rejects
     *   if an error occurs
     * @see {@link Dialog.loadFile Dialog.loadFile()}
     */
    static saveFile ( editor, title = 'File' ) {
        const dialog = new Dialog( title, editor )
        const tabNames = editor.appOptions.fileSaveTabs || [
            'To browser storage', 'To your computer'
        ]
        dialog.setTabs( ...tabNames )
        if ( tabNames.includes( 'To browser storage' ) ) {
            dialog.addItem( new TextInputItem( 'filename', 'Filename' ),
                            'To browser storage' )
            dialog.setDefaultFocus( 'filename' )
        }
        if ( tabNames.includes( 'To your computer' ) ) {
            dialog.addItem( new TextInputItem( 'downloadFilename', 'Filename' ),
                            'To your computer' )
            dialog.addItem( new HTMLItem( `
                <p>Clicking OK below will download the current Lurch document to
                your computer as an HTML file.</p>
            ` ), 'To your computer' )
        }
        const LD = new LurchDocument( editor )
        let filename = LD.getFileID()
        if ( filename && filename.startsWith( 'file:///' ) ) {
            dialog.setInitialData( {
                downloadFilename : filename.substring( 8 )
            } )
        } else if ( filename && !isValidURL( filename ) ) {
            dialog.setInitialData( { filename } )
        }
        dialog.json.size = 'medium'
        return new Promise( ( resolve, reject ) => {
            dialog.show().then( userHitOK => {
                if ( !userHitOK ) return resolve( false )
                const title = dialog.currentTabTitle()
                if ( title == 'To browser storage' ) {
                    const filename = dialog.get( 'filename' )
                    saveAs( editor, filename )
                    resolve( filename )
                } else if ( title == 'To your computer' ) {
                    LD.setFileID( `file:///${ dialog.get( 'downloadFilename' ) }` )
                    downloadFile( editor )
                    resolve( true )
                } else {
                    reject( 'Unknown tab: ' + title )
                }
            } ).catch( reject )
            setTimeout( () => {
                const defaultTab = appSettings.get( 'default save dialog tab' )
                if ( tabNames.includes( defaultTab ) )
                    dialog.showTab( defaultTab )
            } )
        } )
    }

    /**
     * Pop up a notification over the editor.  This can be done with TinyMCE's
     * `NotificationManager` class, but this function just makes it slightly
     * more convenient, because the parameters are named, and one does not need
     * to remember the JSON encoding of them.
     * 
     * @param {tinymce.Editor} editor - the editor in which to show the
     *   notification
     * @param {string} type - the type of notification to show, which TinyMCE
     *   requires must be one of "success", "info", "warning", or "error"
     * @param {string} text - the content of the notification
     * @param {integer} timeout - how long (in ms) until the notification
     *   disappears (optional; defaults to 2000 for success notifications and
     *   no timeout for everything else)
     */
    static notify ( editor, type, text, timeout ) {
        if ( type == 'success' )
            timeout ||= 2000
        editor.notificationManager.open( {
            type : type,
            text : text,
            timeout : timeout
        } )
    }

}

/**
 * An item that can be used in a {@link Dialog} to represent an alert (that is,
 * a piece of text that is colored and given an icon to make it more obvious).
 * This corresponds to the "alertbanner" type of body component in a TinyMCE
 * dialog.
 */
export class AlertItem {

    /**
     * Construct an alert item.  An appropriate icon is chosen to correspond to
     * the type of alert constructed.
     * 
     * @param {string} type - the type of alert, one of "info", "warn", "error",
     *   or "success"
     * @param {string} text - the text to show in the alert
     */
    constructor ( type, text ) {
        this.type = type
        this.text = text        
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'alertbanner',
            text : this.text,
            level : this.type,
            icon : this.level == 'success' ? 'selected' :
                   this.level == 'warn' ? 'warning' :
                   this.level == 'info' ? 'info' : 'notice'
        } ]
    }

}

/**
 * An item that can be used in a {@link Dialog} to represent any HTML content.
 * This corresponds to the "htmlpanel" type of body component in a TinyMCE
 * dialog.
 */
export class HTMLItem {

    /**
     * Construct an HTML item.
     * 
     * @param {string} html - the HTML code of the content to show
     */
    constructor ( html ) {
        this.html = html
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ { type : 'htmlpanel', html : this.html } ]
    }

}

/**
 * An item that can be used in a {@link Dialog} to represent a blank text box
 * into which the user can type content.  This corresponds to the "input" type
 * of body component in a TinyMCE dialog.
 */
export class TextInputItem {

    /**
     * Construct a new text input control.
     * 
     * @param {string} name - the key to use to identify this input control's
     *   content in the dialog's key-value mapping for all input controls
     * @param {string} label - the text to place next to the input control to
     *   explain it to the user
     * @param {string} placeholder - optional, the text to include inside the
     *   control when it is blank, as an example
     */
    constructor ( name, label, placeholder ) {
        this.name = name
        this.label = label
        this.placeholder = placeholder
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        const result = {
            type : 'input',
            name : this.name,
            label : this.label
        }
        if ( this.placeholder )
            result.placeholder = this.placeholder
        return [ result ]
    }

}

/**
 * An item that can be used in a {@link Dialog} and shows up as a clickable
 * button.  This corresponds to the "button" type of body component in a TinyMCE
 * dialog.
 */
export class ButtonItem {

    /**
     * Construct a button.
     * 
     * @param {string} text - the text shown on the button
     * @param {function} action - the function to call when the button is
     *   clicked; it will be passed the {@link Dialog} instance
     */
    constructor ( text, action ) {
        this.name = text.replace( /[^_a-zA-Z]/g, '_' )
        this.text = text
        this.action = action
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'button',
            name : this.name,
            text : this.text,
            maximized : true
        } ]
    }

    // internal use only; calls this button's action if it is pressed
    onAction ( dialog, details ) {
        if ( details.name == this.name ) this.action( dialog )
    }

}

/**
 * An item that can be used in a {@link Dialog} and shows up as a dropdown list
 * of options.  This corresponds to the "selectbox" type of body component in
 * a TinyMCE dialog.
 */
export class SelectBoxItem {
    
    /**
     * Construct a select box.
     * 
     * @param {string} name - the name of the control in the dialog, used for
     *   querying its value when the dialog closes, or providing an initial
     *   value when the dialog opens
     * @param {string} label - the label to show next to the select box in the
     *   user interface
     * @param {string[]} items - the array of items to be shown in the select
     *   box in the user interface
     */
    constructor ( name, label, items ) {
        this.name = name
        this.label = label
        this.items = items
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'selectbox',
            name : this.name,
            label : this.label,
            items : this.items.map( name => {
                return { value : name, text : name }
            } )
        } ]
    }

}

/**
 * An item that can be used in a {@link Dialog} and shows up as a checkbox.
 * This corresponds to the "checkbox" type of body component in a TinyMCE
 * dialog.
 */
export class CheckBoxItem {

    /**
     * Construct a checkbox.
     * 
     * @param {string} name - the name of the control in the dialog, used for
     *   querying its value when the dialog closes, or providing an initial
     *   value when the dialog opens
     * @param {string} label - the label to show next to the checkbox in the
     *   user interface
     */
    constructor ( name, label ) {
        this.name = name
        this.label = label
    }

    // internal use only; creates the JSON to represent this object to TinyMCE
    json () {
        return [ {
            type : 'checkbox',
            name : this.name,
            label : this.label
        } ]
    }

}
