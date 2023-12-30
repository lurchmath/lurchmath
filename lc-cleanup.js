
import { Message } from "./validation-messages.js"
import { Expression, Environment } from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

// Several utility functions required by the workhorse function used below:
// Utility function 1: Send an error about a declaration missing a required
// neighbor expression.
const sendModifierError = ( LC, text ) => {
    setTimeout( () => Message.error( text, {
        id : LC.ID(),
        errorType : 'declaration error',
        valid : false,
        reason : text
    } ), 0 )
    LC.remove()
}
// Utility function 2: Get the previous expression or send an error if there is
// none.
const getPrevious = LC => {
    const result = LC.previousSibling()
    if ( !result || !( result instanceof Expression ) ) {
        sendModifierError( LC, 'This declaration needs an expression before it' )
        LC.remove()
    }
    return result
}
// Utility function 3: Get the next expression or send an error if there is
// none.
const getNext = LC => {
    const result = LC.nextSibling()
    if ( !result || !( result instanceof Expression ) ) {
        sendModifierError( LC, 'This declaration needs an expression after it' )
        LC.remove()
    }
    return result
}
// Utility function 4: Traverse an LC's children; if any of them are declarations
// that need to modify one of their siblings, apply the modification in-place,
// or send an error message if it cannot be done.
const applyModifiers = env => {
    for ( let i = 0 ; i < env.numChildren() ; ) {
        const child = env.child( i )
        if ( child.isA( 'LetWithBody' ) ) {
            const next = getNext( child )
            if ( next ) {
                child.lastChild().replaceWith( next )
                child.unmakeIntoA( 'LetWithBody' )
                child.makeIntoA( 'Let' )
                continue
            }
        } else if ( child.isA( 'ForSomePrefix' ) ) {
            const next = getNext( child )
            if ( next ) {
                child.lastChild().replaceWith( next )
                child.unmakeIntoA( 'ForSomePrefix' )
                child.makeIntoA( 'ForSome' )
                continue
            }
        } else if ( child.isA( 'ForSomeSuffix' ) ) {
            const previous = getPrevious( child )
            if ( previous ) {
                child.lastChild().replaceWith( previous )
                child.unmakeIntoA( 'ForSomeSuffix' )
                child.makeIntoA( 'ForSome' )
                continue
            }
        } else if ( child instanceof Environment ) {
            applyModifiers( child )
        }
        i++
    }
}

/**
 * This function performs cleanup of documents, represented by LCs, which have
 * been created by the UI and are about to be sent for validation.  Not all LC
 * structures created by the UI are valid (because the user can do many things),
 * and not all are ready to be sent to the LDE (because the structures produced
 * by MathLive's parser are not always optimal for validation).
 * 
 * This function takes a document LC as input and modifies it in-place.  It
 * takes the following actions.
 * 
 *  1. If any declarations depend on a sibling to be complete (e.g., "let x be
 *     such that" requires a next sibling to be its body), find that sibling
 *     and merge the declaration with it, or send an error message if there is
 *     no such sibling.
 * 
 * (More steps in the cleanup process will be added here; this is extensible,
 * and we will need to extend it.)
 */
export const cleanLC = LC => {
    applyModifiers( LC )
}
