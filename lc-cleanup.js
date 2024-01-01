
import { Message } from './validation-messages.js'
import { Expression } from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'
import { DeclarationType } from './declarations.js'

// Some utility functions required by the workhorse function used below:
// Utility function 1: Send an error about a declaration missing a required
// neighbor expression.
const sendNeighborError = ( LC, beforeOrAfter ) => {
    setTimeout( () => Message.error( text, {
        id : LC.ID(),
        errorType : 'declaration error',
        valid : false,
        reason : `This declaration needs an expression ${beforeOrAfter} it`
    } ), 0 )
    LC.remove()
}
// Utility function 2: Traverse an LC's children; if any of them are declarations,
// make the changes in the document, which may include merging the declaration
// with one of its neighbors.  Send an error message if it cannot be done,
// deleting the erroneous declaration in the process.
const cleanUpDeclarations = env => {
    env.descendantsSatisfying( descendant =>
        descendant.hasAttribute( 'declaration-template' )
    ).forEach( declaration => {
        const declType = DeclarationType.fromTemplate(
            declaration.getAttribute( 'declaraton_template' ) )
        if ( declType.body == 'before' ) {
            const body = declaration.previousSibling()
            if ( !body || !( body instanceof Expression ) ) {
                sendNeighborError( declaration, 'before' )
                declaration.remove()
                return
            }
            declaration.lastChild().replaceWith( body )
        } else if ( declType.body == 'after' ) {
            const body = declaration.nextSibling()
            if ( !body || !( body instanceof Expression ) ) {
                sendNeighborError( declaration, 'after' )
                declaration.remove()
                return
            }
            declaration.lastChild().replaceWith( body )
        }
        declaration.makeIntoA(
            declType.type == 'variable' ? 'Let' :
            declType.body == 'none' ? 'Declare' : 'ForSome'
        )
        if ( !declaration.isA( 'ForSome' ) )
            declaration.makeIntoA( 'given' )
    } )
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
    cleanUpDeclarations( LC )
}
