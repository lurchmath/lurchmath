
/**
 * This module creates a Web Worker to use for doing validation outside of the
 * UI thread.  It loads into that worker the code in
 * {@link module:ValidationWorker the validation worker module}, and then
 * provides two convenient methods for communicating with that worker.
 * 
 * First, you can send a document to the worker for validation by calling the
 * {@link module:Validation.checkDocument checkDocument()} function.  Second,
 * you can listen for message from the worker using the
 * {@link module:Validation.addEventListener addEventListener()} function.
 * 
 * Both this module and the {@link module:ValidationWorker validation worker
 * module} make use of the {@link Message} class for communication, and any
 * client who listens to the events from this module will receive instances of
 * that class as well.
 * 
 * @module Validation
 */

import { Message } from './validation-messages.js'

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
 */
export const checkDocument = putdown =>
    new Message( { type : 'putdown', putdown } ).send( worker )

/**
 * Install an event handler that will receive messages about validation
 * progress.  After any call to {@link module:Validation.checkDocument
 * checkDocument()}, a number of messages will be generated, each one sent to
 * any listeners installed using this function.  The `listener` will be called
 * with a single parameter, an instance of the {@link Message} class.  The
 * sequence of messages will be one of the following two possibilities.
 * 
 *  1. If something went wrong with parsing the serialized document submitted to
 *     {@link module:Validation.checkDocument checkDocument()}, then you will
 *     see:
 *      * A message of type `"error"` with a `"text"` field saying what was
 *        wrong with the serialized document
 *      * A message of type `"done"` indicating that all processing of that
 *        document is complete, and no further messages are coming.
 *  2. If the document could be parsed correctly, then you will see:
 *      * One message for each piece of the document that the
 *        {@link module:ValidationWorker validation worker} decides it should
 *        validate (which may be any list of subtrees of the document, even the
 *        empty list).  Each such message will either be of type `"feedback"`
 *        with fields saying which subtree of the document was validated and
 *        what that validation result was, or it will be of type `"error"` if
 *        some internal error occurred when attempting to validate that piece.
 *      * After all such messages have been sent, the final message will be of
 *        type `"done"` and indicates that all processing of that document is
 *        complete, and no further messages are coming.
 * 
 * @param {function} listener - an event handler that will receive messages
 *   about validation progress
 */
export const addEventListener = listener =>
    worker.addEventListener( 'message',
        event => listener( new Message( event ) ) )
