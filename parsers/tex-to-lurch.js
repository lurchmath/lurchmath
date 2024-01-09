
const replacements = [
    [ /^\\Rightarrow/,            'implies'         ],
    [ /^\\Leftrightarrow/,        'iff'             ],
    [ /^\\mid/,                   'divides'         ],
    [ /^\\sim/,                   '~'               ],
    [ /^!/,                       ' factorial'      ],
    [ /^\\lambda/,                '𝜆'               ],
    [ /^\\rightarrow\\leftarrow/, ' contradiction ' ],
    [ /^\\left([[({])/,           '$1'              ],
    [ /^\\right([})]])/,          '$1'              ],
    [ /^\\mathrm{([^}]*)}/,       ' $1 '            ],
    [ /^\\text{([^}]*)}/,         ' $1 '            ],
    [ /^[{}]/,                    ' '               ],
    [ /^\\\\/,                    '\\'              ] 
]

export const latexToLurch = input => {
    let result = ''
    while ( input.length > 0 ) {
        const lengthBefore = input.length
        for ( let i = 0 ; i < replacements.length ; i++ ) {
            const match = replacements[i][0].exec( input )
            if ( match ) {
                const prefix = input.substring( 0, match[0].length )
                result += prefix.replace( ...replacements[i] )
                input = input.substring( prefix.length )
                break
            }
        }
        if ( input.length == lengthBefore ) {
            result += input[0]
            input = input.substring( 1 )
        }
    }
    return result
}
