
/**
 * This module runs in a background thread, not the browser's main (UI) thread.
 * It will eventually be used to grade documents submitted to it in serialized
 * form, and transmit feedback messages about their contents back to the main
 * thread.  Right now, it implements just a very simple placeholder validation
 * routine to use for testing.  We will later import into it the official
 * validation engine that we are developing in a separate repository.
 * 
 * Any implementation will listen for {@link Message messages} sent to the
 * worker with {@link Message#type type} `"putdown"` and will deserialize them
 * into a document, then try to validate every part of that document that this
 * module deems should be validated.
 * 
 * The current, placeholder implementation just looks for simple equations or
 * inequalities of floating point arithemtic (using operators `+`, `-`, `*`, and
 * `/` and relational operators `=`, `>`, `<`, `>=`, and `<=`) and judges them
 * to be valid if they are true according to JavaScript's floating point
 * computational capabilities, and false otherwise.  Later, actual
 * implementations will be far more sophisticated, symbolic, and useful to
 * students in an introductory proofs course.  This placeholder is merely for
 * testing purposes while we polish the more sophisticated validation engine.
 * 
 * None of the functions in this module are called by any external client, and
 * hence none are documented here.  Rather, this script is loaded into Web
 * Worker instances, and messages are passed to it as documented above, and
 * messages are received back from it as documented in
 * {@link module:Validation the validation module}.
 * 
 * @module ValidationWorker
 */

import { Message } from './validation-messages.js'
import { LogicConcept, LurchSymbol }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

// Listen for messages from the main thread, which should send putdown notation
// for a document to validate.  When it does, we run our one (temporary
// placeholder) validation routine, which will send "feedback" and "done"
// messages, as appropriate.  Any non-putdown messages we receive generate error
// feedback instead.
addEventListener( 'message', event => {
    const message = new Message( event )
    if ( !message.is( 'document' ) )
        return Message.error( 'Not a document message' )
    const encoding = message.get( 'encoding' )
    const code = message.get( 'code' )
    try {
        if ( encoding == 'putdown' ) {
            const LCs = LogicConcept.fromPutdown( code )
            if ( LCs.length != 1 )
                throw new Error( 'Incorrect number of LCs: ' + LCs.length )
            validateDocument( LCs[0] )
        } else if ( encoding == 'json' ) {
            validateDocument( LogicConcept.fromJSON( code ) )
        } else {
            throw new Error( `Not a valid document encoding: ${encoding}` )
        }
    } catch ( error ) {
        Message.error( error.message || `${error}` )
        Message.done()
    }
} )

// Placeholder validation routine, using all the other routines below, to
// validate only equations and inequalities of floating point arithmetic.
const validateDocument = LC => {
    LC.descendantsSatisfying( isArithmeticSentence ).forEach( sentence => {
        try {
            const result = checkArithmetic( sentence )
            let walk
            for ( walk = sentence ; walk ; walk = walk.parent() )
                if ( walk.ID() ) break
            Message.feedback( {
                id : sentence.ID(),
                ancestorID : walk ? walk.ID() : undefined,
                address : sentence.address( LC ),
                putdown : sentence.toPutdown(),
                valid : result
            } )
        } catch ( error ) {
            Message.error( error.message )
        }
    } )
    Message.done()
}

const floatRE = /^[+-]?(?:\d+[.]?\d*|\d*[.]?\d+)$/
const arithmeticOperators = [ '+', '-', '*', '/' ]
const relationalOperators = [ '=', '>', '<', '>=', '<=' ]

const isNumber = LC =>
    ( LC instanceof LurchSymbol ) && floatRE.test( LC.text() )

const isOperation = LC => {
    return LC.numChildren() >= 2 && ( LC.firstChild() instanceof LurchSymbol )
        && LC.allButFirstChild().every( isArithmeticExpression )
}

const isArithmeticSentence = LC => {
    return LC.numChildren() == 3 && isOperation( LC )
        && relationalOperators.includes( LC.firstChild().text() )
}

const isArithmeticExpression = LC => {
    // base case: a number alone
    if ( isNumber( LC ) ) return true
    // all other cases must be operator applied to operands
    if ( !isOperation( LC ) ) return false
    // unary case: must be unary negation
    if ( LC.numChildren() == 2 )
        return LC.firstChild().text() == "-"
    // binary case: must be any arithmetical operator
    if ( LC.numChildren() == 3 )
        return arithmeticOperators.includes( LC.firstChild().text() )
    // no cases above binary are supported
    return false
}

const evaluateExpression = LC => {
    if ( isNumber( LC ) ) return parseFloat( LC.text() )
    if ( LC.numChildren() != 2 && LC.numChildren() != 3 )
        throw new Error( `Not an arithmetic expression: ${LC.toPutdown()}` )
    let operator = LC.firstChild()
    if ( !( operator instanceof LurchSymbol )
      || !arithmeticOperators.includes( operator.text() ) )
        throw new Error( `Not an arithmetic operator: ${operator.toPutdown()}` )
    operator = operator.text()
    const args = LC.allButFirstChild().map( evaluateExpression )
    if ( args.length == 1 ) {
        if ( operator == '-' ) return -args[0]
        throw new Error( `Not a unary operator: ${operator}` )
    }
    switch ( operator ) {
        case '+': return args[0] + args[1]
        case '-': return args[0] - args[1]
        case '*': return args[0] * args[1]
        case '/': return args[0] / args[1]
    }
}

const checkArithmetic = LC => {
    if ( LC.numChildren() != 3 )
        throw new Error( `Not an arithmetic sentence: ${LC.toPutdown()}` )
    let operator = LC.firstChild()
    if ( !( operator instanceof LurchSymbol )
      || !relationalOperators.includes( operator.text() ) )
        throw new Error( `Not an arithmetic relation: ${operator.toPutdown()}` )
    operator = operator.text()
    const args = LC.allButFirstChild().map( evaluateExpression )
    switch ( operator ) {
        case '=': return args[0] == args[1]
        case '>': return args[0] > args[1]
        case '<': return args[0] < args[1]
        case '>=': return args[0] >= args[1]
        case '<=': return args[0] <= args[1]
    }
}
