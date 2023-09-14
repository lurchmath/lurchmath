
/**
 * This class simplifies communication between the main thread and worker
 * threads by encapsulating their communication protocol into a single class
 * that can be used on both ends of the channel.
 * 
 * To send a message to a worker, create an instance of this class and then call
 * `message.send( worker )`.  To send a message from a worker, create an
 * instance and call `message.send()` (which therefore just goes "out").  In the
 * message event handler on either end, you can construct a new `Message`
 * instance from the event itself, and its data will be extracted appropriately.
 * For example:
 * 
 * ```js
 * worker.addEventListener( 'message', event => {
 *     const message = new Message( event )
 *     if ( message.is( 'error' ) ) { // check type
 *         const errorMessage = message.get( 'text' )
 *         // etc...
 *     } else {
 *         // etc...
 *     }
 * } )
 * ```
 * 
 * Having one class that's imported into both the main thread and the worker
 * means not dividing the communication protocol code over multiple files, and
 * thus improving consistency and reducing chances of logic errors.
 * 
 * Tbere are also some static members that make certain message-sending
 * operations more concise and readable; see below.
 */
export class Message {

    /**
     * Construct a new message instance with the given content.  The `content`
     * may be any of the following:
     * 
     *  * An `Event` instance, as shown in the example at the top of this class
     *    documentation.  In that case, the `data` attribute of the event will
     *    be stored as the `content` attribute of the new `Message` instance,
     *    because `event.data` is where user-specific information is stored for
     *    message events.
     *  * A string, which will be interpreted as the text of the message, and
     *    thus the newly created instance will have as its `content` field an
     *    object with just a `text` field, this string.
     *  * An object, which will be used directly as the newly created instance's
     *    `content` field.
     * 
     * Any other kind of `content` throws an error.
     * 
     * @param {Object|string} content - the content of the message, as described
     *   above
     */
    constructor ( content ) {
        this.content = content instanceof Event ? content.data : content
        if ( content instanceof Event ) {
            this.content = content.data
        } else if ( typeof( content ) == 'string' ) {
            this.content = { text : content }
        } else if ( content instanceof Object ) {
            this.content = content
        } else {
            throw new Error( `Cannot create a Message from this: ${content}` )
        }
    }

    /**
     * The content of a message, given at construction time, may include a
     * `type` field, which should be a string, if present.  It can indicate
     * whether the message is apiece of feedback, an error, or some other type
     * of message.  Any string is permitted; there is no official list.  A
     * message is not required to have a `type` field.
     * 
     * This function tests whether this instance has the given type.  It simply
     * compares the parameter passed to the `type` field in the instance's
     * `content` field (which is undefined if absent).
     * 
     * @param {string} type - the type to test this instance against
     * @returns {boolean} whether this instance is of that type
     */
    is ( type ) { return this.content.type == type }

    /**
     * Because a message's `content` field is an object, it can be used like a
     * dictionary of key-value pairs.  This function looks up the given key in
     * the `content` member.  It is just a more readable/convenient version of
     * `message.content["key"]`.
     * 
     * There is no corresponding setter function because messages are intended
     * to be lightweight, short-lived objects.  You provide their content when
     * instantiating them, then you send them somewhere or react to them, and
     * then let them be garbage collected.
     * 
     * @param {string} key - the key whose value should be looked up
     * @returns {*} the corresponding value (or undefined if the key is absent)
     */
    get ( key ) { return this.content[key] }

    /**
     * Send this message to a worker or to the main thread.  If you provide a
     * target, we will attempt to send the message there, so if you are using a
     * Message in the main thread and want to send it to a worker, call
     * `message.send( worker )`.  If you do not provide a target, we will
     * attempt to send the message to the main thread.  So workers can just call
     * `message.send()`.
     * 
     * Note that there are also static members of this class for sending common
     * types of messages that let you write slightly more compact and readable
     * code than constructing and sending a message in one line of code.
     * 
     * @param {Worker?} target - the worker to which to send the message, if any
     */
    send ( target ) {
        if ( target ) {
            target.postMessage( this.content )
        } else {
            postMessage( this.content )
        }
    }

    /**
     * This function is intended for use in workers, to communicate back to the
     * main thread.  It constructs a message instance, gives it the type
     * `"feedback"`, also includes all of the fields in the parameter provided,
     * and sends that message back to the main thread.
     * 
     * This can be done in one line of code without this convenience function,
     * but using this method makes the code more concise and readable.
     * 
     * @param {Object} data - any type of data to include in the feedback
     *   message
     */
    static feedback ( data ) {
        new Message( { type : 'feedback', ...data } ).send()
    }

    /**
     * This function is intended for use in workers, to communicate back to the
     * main thread.  It constructs a message instance, gives it the type
     * `"done"`, and sends that message back to the main thread.
     * 
     * This can be done in one line of code without this convenience function,
     * but using this method makes the code more concise and readable.
     */
    static done () {
        new Message( { type : 'done' } ).send()
    }

    /**
     * This function is intended for use in workers, to communicate back to the
     * main thread.  It constructs a message instance, gives it the type
     * `"error"`, sets its text field to the parameter given, and sends that
     * message back to the main thread.  If the second parameter is provided,
     * all of its fields are also included in the message's content.
     * 
     * This can be done in one line of code without this convenience function,
     * but using this method makes the code more concise and readable.
     * 
     * @param {string} text - the contents of the error message
     * @param {Object?} more - any other key-value pairs to be included in the
     *   message's content (optional)
     */
    static error ( text, more = { } ) {
        new Message( { type : 'error', text, ...more } ).send()
    }

}
