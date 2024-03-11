
export { latexToLurch } from './tex-to-lurch.js'
import { parse as parseToPutdown } from './lurch-to-putdown.js'
import { parse as parseToLatex } from './lurch-to-tex.js'

const lurchToPutdownOptions = { debug:false, enableSets:true } 
export const lurchToPutdown = ( lurch ) => {
    const putdown = parseToPutdown( lurch, lurchToPutdownOptions )
    return putdown
}

const lurchToLatexOptions = { debug:false, enableSets:true }
export const lurchToLatex = ( lurch ) => {
    const latex = parseToLatex( lurch, lurchToLatexOptions )
    return latex
}