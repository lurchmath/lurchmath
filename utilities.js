
export const loadScript = url => new Promise( ( resolve, reject ) => {
    const scriptTag = document.createElement( 'script' )
    document.head.append( scriptTag )
    scriptTag.setAttribute( 'defer', true )
    scriptTag.setAttribute( 'referrerpolicy', 'origin' )
    scriptTag.addEventListener( 'load', resolve )
    scriptTag.addEventListener( 'error', reject )
    scriptTag.setAttribute( 'src', url )
} )
