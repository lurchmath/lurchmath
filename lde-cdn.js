
/**
 * This file imports all needed classes from the main branch of the LDE repo.
 * We do it in this file so that anywhere else in the app, it can just load this
 * file and know it's getting the right classes.  Then if we need to change the
 * URL, we can do it here in one place, rather than in many places throughout
 * the codebase.
 */

export {
    LogicConcept, MathConcept,
    Environment, Declaration, Expression, LurchSymbol
} from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

import branchLDE from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@a584652687e37356dad01cd7eeea84cecad56b52/src/experimental/global-validation.js'
export const LDE = branchLDE
