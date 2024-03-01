
const replacements = [
    [ /^\\Rightarrow/,            'implies'         ],
    [ /^\\Leftrightarrow/,        'iff'             ],
    [ /^\\mid/,                   'divides'         ],
    [ /^\\sim/,                   '~'               ],
    [ /^\\land/,                  ' and '           ],
    [ /^\\lor/,                   ' or '            ],
    [ /^\\lnot/,                  ' not '           ],
    [ /^\\neg/,                   ' not '           ],
    [ /^!/,                       ' factorial'      ],
    [ /^\\lambda/,                '𝜆'               ],
    [ /^\\rightarrow\\leftarrow/, ' contradiction ' ],
    [ /^\\left([[(])/,            '$1'              ],
    [ /^\\right([)]])/,           '$1'              ],
    [ /^\\left\\{/,               '{'               ],
    [ /^\\right\\}/,              '}'               ],
    [ /^\\{/,                     '{'               ],
    [ /^\\}/,                     '}'               ],
    [ /^\\mathrm{([^}]*)}/,       ' $1 '            ],
    [ /^\\text{([^}]*)}/,         ' $1 '            ],
    [ /^[{}]/,                    ' '               ],
    [ /^\\\\/,                    '\\'              ]
]

export const latexToLurch = input => {
    let result = ''
    while ( input.length > 0 ) {
        let match = null
        for ( let i = 0 ; i < replacements.length ; i++ ) {
            match = replacements[i][0].exec( input )
            if ( match ) {
                const prefix = input.substring( 0, match[0].length )
                result += prefix.replace( ...replacements[i] )
                input = input.substring( prefix.length )
                break
            }
        }
        if ( !match ) {
            result += input[0]
            input = input.substring( 1 )
        }
    }
    return result
}
