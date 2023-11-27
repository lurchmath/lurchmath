
/**
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

// Internal use only, the worker in which validation will occur.
// Loads the ValidationWorker module code so it can talk to us.
const worker = new Worker( 'validation-worker.js', { type : 'module' } )

/**
 * Send a serialized document to the worker for validation.  It is necessary for
 * the document to be serialized, because objects cannot be shared across the
 * main thread/worker thread boundary.  Here we require the data to be
 * serialized in putdown notation, but that could be extended to support other
 * notations in the future, including anything that can be parsed into an
 * expression tree, such as JSON, etc.
 * 
 * No value is returned, but validation will begin.  Messages will be sent to
 * any listener installed using {@link module:Validation.addEventListener
 * addEventListener()}, and those messages will be a sequence of zero or more
 * messages of type `"feedback"` or type `"error"` followed by exactly one
 * message of type `"done"`.
 * 
 * Calling this function again before you have received the `"done"` message
 * from the previous call will just queue up the second validation to happen
 * after the first one completes.
 * 
 * @param {string} putdown - the document to validate, represented in putdown
 *   notation
 * @function
 */
export const run = ( editor, encoding = 'json' ) =>
    Message.document( editor, encoding ).send( worker )

// Internal use only
// Remove all validation markers from an Atom or atom element
const clearValidation = target => {
    if ( Atom.isAtomElement( target ) ) target = new Atom( target )
    if ( !( target instanceof Atom ) )
        throw new Error( `Invalid validation target: ${target}` )
    target.removeChild( 'suffix' )
    target.setHoverText( null )
}

// Internal use only
// Create HTML for the feedback icon to place into the suffix of an atom
// element, based on the feedback message received
const markerHTML = message => {
    if ( message.is( 'feedback' ) )
        return message.get( 'valid' ) ? '<span class="checkmark">&check;</span>'
                                    : '<span class="redx">✗</span>'
    if ( message.is( 'error' ) )
        return '<span class="errormark">!</span>'
}

// Internal use only
// Append a validation marker to the suffix of an atom element.
// Note that this is additive, because there may be multiple markers on any
// given atom element (e.g., if it contains multiple subparts to validate).
const addValidation = ( target, marker ) => {
    if ( Atom.isAtomElement( target ) ) target = new Atom( target )
    if ( !( target instanceof Atom ) )
        throw new Error( `Invalid validation target: ${target}` )
    const suffix = target.getChild( 'suffix' )
    target.fillChild( 'suffix', suffix.innerHTML + marker )
}

// Internal use only
// Install event handler so that we can decorate the document correctly upon
// receiving validation feedback.  We install it on both the worker and this
// window, becauase when parsing errors happen, we send feedback about them from
// this window itself before even sending anything to the worker.
[ worker, window ].forEach( context =>
    context.addEventListener( 'message', event => {
        const message = new Message( event )
        if ( message.is( 'feedback' ) || message.is( 'error' ) ) {
            if ( message.element ) {
                if ( Atom.isAtomElement( message.element ) ) {
                    const atom = new Atom( message.element )
                    addValidation( atom, markerHTML( message ) )
                    if ( message.content.text )
                        atom.setHoverText( message.content.text )
                } else {
                    throw new Error( 'Feedback message for non-atoms not supported' )
                }
            } else {
                throw new Error( 'Feedback message received with no element as target' )
            }
        } else if ( message.is( 'done' ) ) {
            // pass
        } else {
            console.log( 'Ignoring this message:', message )
        }
    } )
)

// Internal use only
// Remove all validation markers from all atom element suffixes in the given
// editor
const clearAll = editor => Atom.allIn( editor ).forEach( clearValidation )

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
 * @param {tinymce.Editor} editor - the editor in which to install the features
 *   described above
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'clearvalidation', {
        text : 'Clear validation',
        tooltip : 'Remove all validation markers from the document',
        shortcut : 'Meta+Shift+C',
        onAction : () => clearAll( editor )
    } )
    editor.ui.registry.addMenuItem( 'validate', {
        text : 'Validate',
        icon : 'checkmark',
        tooltip : 'Run validation on the document',
        shortcut : 'Meta+Shift+V',
        onAction : () => {
            clearAll( editor )
            run( editor )
        }
    } )
}

export default { install, run }
