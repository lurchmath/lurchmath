
import { loadScript, copyWithoutPrototype } from '../utilities.js'

describe( 'Utilities', () => {

    it( 'Should import correct identifiers', () => {
        expect( loadScript ).to.be.ok
        expect( copyWithoutPrototype ).to.be.ok
    } )

    it( 'Should load scripts asynchronously with loadScript()', done => {
        expect( window.globalValueForTesting ).to.be.undefined
        loadScript( './tiny-test-script.js' ).then( () => {
            expect( window.globalValueForTesting ).to.equal( 5 )
            delete window.globalValueForTesting // clean up global leak
            done()
        } )
    } )

    it( 'Should make copies correctly with copyWithoutPrototype()', () => {
        class TestClass { constructor ( n ) { this.number = n } }
        const obj1 = new TestClass( 5 )
        expect( obj1.number ).to.equal( 5 )
        expect( obj1 ).to.be.instanceof( TestClass )
        const obj2 = copyWithoutPrototype( obj1 )
        expect( obj2.number ).to.equal( 5 )
        expect( obj2 ).not.to.be.instanceof( TestClass )
    } )

} )
