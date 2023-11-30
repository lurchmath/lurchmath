
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
import { Shell } from './shells.js'

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
// Right now this just drops the "undeclared variable" errors and keeps
// everything else, but later it will be made more sophisticated, so that it can
// obey the document settings, keeping just the relevant validation, as the user
// has requested.
const filterValidationResults = results =>
    results.filter( item => item.type != 'scoping'
                         || !item.reason.endsWith( 'undeclared' ) )

// Internal use only
// Get first non-filtered feedback item
const extractFeedback = results => {
    const relevant = filterValidationResults( results )
    return relevant.length == 0 ? null : relevant[0]
}

// Internal use only
// Create HTML for the feedback icon to place into the suffix of an atom
// element, based on the feedback message received
const markerHTML = message => {
    if ( message.is( 'feedback' ) ) {
        const feedback = extractFeedback( message.get( 'results' ) )
        switch ( feedback?.result ) {
            case 'valid'   : return '<span class="checkmark">&check;</span>'
            case 'invalid' : return '<span class="redx">✗</span>'
            default        : return '<span class="unknown">?</span>'
        }
    }
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
        console.log( JSON.stringify( message.content, null, 4 ) )
        const firstFeedback = message.is( 'feedback' ) ?
            extractFeedback( message.get( 'results' ) ) : null
        if ( ( message.is( 'feedback' ) && firstFeedback )
          || message.is( 'error' ) ) {
            if ( message.element ) {
                console.log( message.element )
                if ( Atom.isAtomElement( message.element ) ) {
                    const atom = new Atom( message.element )
                    addValidation( atom, markerHTML( message ) )
                    atom.setHoverText( firstFeedback.reason )
                } else if ( Shell.isShellElement( message.element ) ) {
                    message.element.dataset['validation_result'] = firstFeedback.result
                    new Shell( message.element ).setHoverText( firstFeedback.reason )
                } else {
                    console.log( 'Warning: feedback message received for unusable element' )
                    // console.log( JSON.stringify( message.content, null, 4 ) )
                }
            } else {
                console.log( 'Warning: feedback message received with no target element' )
                // console.log( JSON.stringify( message.content, null, 4 ) )
            }
        } else if ( message.is( 'done' ) ) {
            // pass
        } else {
            console.log( 'Warning: unrecognized message type' )
            // console.log( JSON.stringify( message.content, null, 4 ) )
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
