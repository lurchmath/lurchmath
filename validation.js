
/**
 * This module provides an `install()` function for use in the editor's setup
 * routine, to add this module's validation functionality to the editor.  The
 * install routine does all the work of this module; there are no module-level
 * variables.  Each call to `install()` creates a new background Web Worker
 * that will do validation, installs a new set of event handlers for it, etc.
 * See {@link module:Validation.install install()} for details.
 *
 * This module creates a Web Worker to use for doing validation outside of the
 * UI thread.  It loads into that worker the code in
 * {@link module:ValidationWorker the validation worker module}, and then
 * provides related tools to clients.
 * 
 * First, you can send a document to the worker for validation by calling the
 * {@link module:Validation.run run()} function.
 * 
 * Both this module and the {@link module:ValidationWorker validation worker
 * module} make use of the {@link Message} class for communication, and any
 * client who listens to the events from this module will receive instances of
 * that class as well.
 * 
 * @module Validation
 */

import { Message } from './validation-messages.js'
import { Atom } from './atoms.js'
import { Dialog } from './dialog.js'
import { isOnScreen } from './utilities.js'

/**
 * This function should be called in the editor's setup routine.  It installs
 * two menu items into the editor:
 * 
 *  * one for running validation on the editor's current contents, and showing
 *    the results in the editor by placing suffixes on each atom that could be
 *    validated
 *  * one for removing all such validation suffixes from the editor's current
 *    contents
 * 
 * In order to support the functionality of those two menu items, the
 * `install()` function also constructs a web worker that will do the validation
 * in the background, and that web worker loads the tools in the
 * {@link module:ValidationWorker validation worker module}.  This function also
 * installs event handlers on the worker and on this window so that
 * {@link Message Message instances} sent from the worker or from this window
 * during parsing can be handled and used to create validation feedback in the
 * editor.
 * 
 * @param {tinymce.Editor} editor - the editor in which to install the features
 *   described above
 * @function
 */
export const install = editor => {

    // Load the ValidationWorker module code so it can talk to us.
    const worker = new Worker( 'validation-worker.js', { type : 'module' } )

    // Object for storing the progress notification we show during validation
    let progressNotification = null

    // Define utility function used below:
    // Remove all validation markers from all atoms and shells in the editor
    const clearAll = () => {
        Atom.allIn( editor ).forEach( atom =>
            atom.setValidationResult( null ) )
    }

    // Global(ish) variable used by the function below
    let clearIsPending = false
    // Same as previous utility function, but this one queues them up, so that
    // (a) they don't happen immediately and (b) multiple calls can get
    // compressed into a single result, for efficiency.
    const queueClearAll = () => {
        if ( clearIsPending ) return
        clearIsPending = true
        setTimeout( () => {
            clearAll( editor )
            clearIsPending = false
        }, 0 )
    }

    // Install that validation clearing function as the event handler for any
    // change made to the internal data of an atom or shell (or the creation of
    // an atom or shell).
    Atom.prototype.dataChanged = function () {
        if ( this.editor == editor && isOnScreen( this.element )
          && editor.dom.doc.body.contains( this.element ) )
            queueClearAll()
    }

    // Install event handler so that we can decorate the document correctly upon
    // receiving validation feedback.  We install it on both the worker and this
    // window, becauase when parsing errors happen, we send feedback about them
    // from this window itself before even sending anything to the worker.
    ;[ worker, window ].forEach( context =>
        context.addEventListener( 'message', event => {
            const message = new Message( event )
            // console.log( JSON.stringify( message.content, null, 4 ) )
            if ( message.is( 'feedback' ) || message.is( 'error' ) ) {
                if ( message.element ) {
                    // console.log( message.element )
                    if ( Atom.isAtomElement( message.element ) ) {
                        const result = message.getValidationResult()
                        const reason = message.getValidationReason()
                        if ( result !== undefined || reason !== undefined )
                        Atom.from( message.element, editor )
                            .setValidationResult( result, reason )
                    } else {
                        console.log( 'Warning: feedback message received for unusable element' )
                        // console.log( JSON.stringify( message.content, null, 4 ) )
                    }
                } else if ( message.content.id == 'documentEnvironment' ) {
                    // feedback about whole document; ignore for now
                } else {
                    console.log( 'Warning: feedback message received with no target element' )
                    // console.log( JSON.stringify( message.content, null, 4 ) )
                }
            } else if ( message.is( 'progress' ) ) {
                progressNotification.progressBar.value( message.get( 'complete' ) )
            } else if ( message.is( 'done' ) ) {
                progressNotification.close()
                Dialog.notify( editor, 'success', 'Validation complete', 2000 )
                progressNotification = null
            } else if ( message.content?.type?.startsWith( 'mathlive#' ) ) {
                // Ignore messages MathLive is sending to itself
            } else {
                console.log( 'Warning: unrecognized message type' )
                // console.log( JSON.stringify( message.content, null, 4 ) )
            }
        } )
    )

    // Add menu item for clearing validation results
    editor.ui.registry.addMenuItem( 'clearvalidation', {
        text : 'Clear validation',
        tooltip : 'Remove all validation markers from the document',
        shortcut : 'Meta+Shift+C',
        onAction : () => clearAll()
    } )
    
    // Add menu item for running validation
    editor.ui.registry.addMenuItem( 'validate', {
        text : 'Validate',
        icon : 'checkmark',
        tooltip : 'Run validation on the document',
        shortcut : 'Meta+Shift+V',
        onAction : () => {
            // Clear old results
            clearAll()
            // Start progress bar in UI
            progressNotification = editor.notificationManager.open( {
                text : 'Validating...',
                type : 'info',
                progressBar : true
            } )
            // Send the document to the worker to initiate background validation
            Message.document( editor, 'putdown' ).send( worker )
        }
    } )
}

export default { install }
