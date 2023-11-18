
/**
 * This module loads scripts from the MathLive library (from
 * https://cortexjs.io/mathlive/), and then creates from it several different
 * tools useful in the Lurch application.
 * 
 * First, it creates the {@link MathItem} class, which can be added to
 * {@link Dialog} instances as an input component containing an equation editor.
 * (Note that I say "equation editor" here because that is common parlance, but
 * of course one can use it for many types of mathematical expressions, not just
 * equations.)
 * 
 * Second, it creates several functions for converting among various math
 * notation formats.  See {@link module:MathLive.getConverter getConverter()}
 * for details.
 * 
 * @module MathLive
 */

import { loadScript } from './utilities.js'

// Internal use only.
// Ensures the MathLive scripts are loaded, so you can do whatever you want with
// the stuff they install in the global (window) object thereafter.
const loadMathFieldClass = () =>
    loadScript( 'https://unpkg.com/mathlive' ).then( () =>
    loadScript( 'https://unpkg.com/@cortex-js/compute-engine' ) )

/**
 * We store here the URL to the MathLive CSS stylesheet, so that we can define
 * it in only one location and others can reference it from here.
 * 
 * @type {string}
 */
export const stylesheet = 'https://unpkg.com/mathlive@0.96.2/dist/mathlive-static.css'

/**
 * An item that can be used in a {@link Dialog} and shows up as an equation
 * editor powered by a MathLive math editing component.
 */
export class MathItem {

    /**
     * Construct a MathLive editing component.
     * 
     * @param {string} name - the name of the control in the dialog, used for
     *   querying its value when the dialog closes, or providing an initial
     *   value when the dialog opens
     * @param {string} label - the label to show next to the math ediitor in the
     *   user interface
     */
    constructor ( name, label ) {
        this.name = name
        this.label = label
        this.setupInitiated = false
        this.mathLiveEditor = null
        this.mathValue = null
        this.focusWhenShown = false
    }

    /**
     * Whether to focus this item once it has loaded.  Defaults to `false`, so
     * as to not interfere with the usual focus mechanics of the {@link Dialog}
     * class.  However, because this component is a unique one, the normal focus
     * mechanics will not work for it, so you should call this function to
     * override them if you want this item to receive focus once it has been
     * installed into the dialog.
     * 
     * @param {boolean} value - whether to focus this item once it appears
     */
    setFocusWhenShown ( value ) { this.focusWhenShown = value }

    // internal use only; creates the JSON to represent this object to TinyMCE
    // (actually, it creates an HTML element that will LATER be populated
    // programmatically with a MathLive editor)
    json () {
        return [
            {
                type : 'htmlpanel',
                html : `
                    <label class='tox-label'>${this.label}</label>
                    <div id='math-${this.name}'>Loading editor...</div>
                `
            }
        ]
    }

    // Internal use only.
    // Stores the current value of the MathLive editor, as a LaTeX string,
    // because once the editor is closed, you can't get this value back.  So we
    // need to store it somewhere for retrieval even after the editor closes.
    saveValue () { this.mathValue = this.mathLiveEditor?.value }
    // Internal use only; how to fetch the value stored by saveValue().
    savedValue () { return this.mathValue }

    // Called whenever the dialog is shown (or, if this item is inside a tab,
    // whenever that tab is shown).  This is what initializes the MathLive
    // editor into the DIV created by the `json()` method, and installs an
    // event handler that calls saveValue() whenever an edit takes place.
    onShow () {
        if ( this.setupInitiated ) return
        this.setupInitiated = true
        loadMathFieldClass().then( () => {
            document.body.style.setProperty( '--keyboard-zindex', '2000' )
            this.mathLiveEditor = new MathfieldElement()
            this.mathLiveEditor.value = this.dialog.json.initialData[this.name] || ''
            this.mathLiveEditor.style.width = '100%'
            this.mathLiveEditor.style.border = 'solid 1px #cccccc'
            const insertHere = document.getElementById( `math-${this.name}` )
            while ( insertHere.firstChild )
                insertHere.removeChild( insertHere.firstChild )
            insertHere.appendChild( this.mathLiveEditor )
            delete this.mathLiveEditor.shadowRoot.querySelector(
                '.ML__virtual-keyboard-toggle' ).dataset['ml__tooltip']
            this.saveValue()
            this.mathLiveEditor.addEventListener( 'input',
                () => this.saveValue() )
            if ( this.focusWhenShown )
                this.mathLiveEditor.focus()
        } )
    }

    /**
     * Get the saved value of the equation editor, as a LaTeX string.
     * 
     * @param {string} key - the key whose value should be looked up
     * @returns {string?} the value associated with the given key, if the key
     *   is the one that this item is in charge of editing, or undefined
     *   otherwise
     */
    get ( key ) { if ( key == this.name ) return this.savedValue() }

}

/**
 * MathJSON is a format invented by the author of MathLive, and documented here:
 * https://cortexjs.io/math-json/
 * 
 * This function converts the given MathJSON structure to putdown notation.
 * It is not exported by this module.  Instead, to be able to use it, you should
 * asynchronously construct a converter object using the
 * {@link module:MathLive.getConverter getConverter()} function, and then this
 * will be one of that converter object's methods.  The reason is that some of
 * the conversion functions can be run only once MathLive has been loaded, and
 * the asynchronous {@link module:MathLive.getConverter getConverter()} function
 * ensures that has happened before providing you with a converter instance.
 * 
 * @param {Object} json - the MathJSON structure to convert
 * @returns {string} the putdown notation of the given structure
 * @function
 */
const mathJSONToPutdown = json => {
    // MathJSON numbers come in 3 formats:
    // 1. plain numbers
    if ( !isNaN( json ) ) return `${json}`
    // 2. object literals with a "num" field
    if ( json.num ) return `${json.num}`
    // 3. a string starting with +, -, or a digit 0-9
    if ( ( typeof( json ) == 'string' ) && '+-0123456789'.includes( json[0] ) )
        return json
    // MathJSON strings come in 2 formats:
    // 1. a string with a leading and trailing apostrophe
    if ( ( typeof( json ) == 'string ' )
      && ( json[0] == '\'' ) && ( json[json.length - 1] == '\'' ) )
        return JSON.parse( json )
    // 2. object literals with a "str" field
    if ( json.str ) return json.str
    // MathJSON symbols come in 2 formats:
    // 1. a string that doesn't match the format for strings given above
    if ( typeof( json ) == 'string' ) return json
    // 2. an object literal with a "sym" field
    if ( json.sym ) return json.sym
    // MathJSON function applications come in 3 formats:
    // 1. a JavaScript array
    if ( json instanceof Array )
        return '(' + json.map( mathJSONToPutdown ).join( ' ' ) + ')'
    // 2. object literals with a "fn" field
    if ( json.fn )
        return '(' + json.fn.map( mathJSONToPutdown ).join( ' ' ) + ')'
    // MathJSON also supports dictionaries, but putdown does not.
    // So every other kind of MathJSON object just gets called "unsupported":
    return `(unsupported_MathJSON ${JSON.stringify( json )})`
}

/**
 * MathJSON is a format invented by the author of MathLive, and documented here:
 * https://cortexjs.io/math-json/
 * 
 * This function converts the given $\LaTeX$ code to a MathJSON structure.
 * It is not exported by this module.  Instead, to be able to use it, you should
 * asynchronously construct a converter object using the
 * {@link module:MathLive.getConverter getConverter()} function, and then this
 * will be one of that converter object's methods.  The reason is that some of
 * the conversion functions can be run only once MathLive has been loaded, and
 * the asynchronous {@link module:MathLive.getConverter getConverter()} function
 * ensures that has happened before providing you with a converter instance.
 * 
 * @param {string} latex - the $\LaTeX$ code to convert into MathJSON format
 * @returns {Object} a JSON object following the MathJSON standard, linked to
 *   above
 * @see {@link module:MathLive.mathJSONToPutdown mathJSONToPutdown()}
 * @see {@link module:MathLive.latexToPutdown latexToPutdown()}
 * @see {@link module:MathLive.latexToHTML latexToHTML()}
 * @function
 */
const latexToMathJSON = latex =>
    MathfieldElement.computeEngine.parse( latex, { canonical: false } ).json

/**
 * A converter instance is just an object that gives you access to four
 * conversion functions:
 * 
 *  1. {@link module:MathLive.mathJSONToPutdown mathJSONToPutdown()}, which is
 *     defined in this module
 *  1. {@link module:MathLive.latexToMathJSON latexToMathJSON()}, which is also
 *     defined in this module
 *  1. `latexToPutdown()`, which is just the composition of the previous two
 *  1. `latexToHTML()`, which is just a convenient exposure of the
 *     `convertLatexToMarkup()` function built into MathLive.
 * 
 * The reason that this function is asynchronous is because some of those
 * conversion functions can be run only once MathLive has been loaded, and so
 * this function ensures that has happened before returning to you a converter
 * instance.  That way, the instance you receive is guaranteed to work
 * immediately, and all of its methods can be synchronous.
 * 
 * @returns {Promise} a promise that resolves to an object containing the
 *   four conversion functions defined in this module, as described above
 * @see {@link module:MathLive.mathJSONToPutdown mathJSONToPutdown()}
 * @see {@link module:MathLive.latexToMathJSON latexToMathJSON()}
 * @function
 */
export const getConverter = () => loadMathFieldClass().then( () => ( {
    mathJSONToPutdown : mathJSONToPutdown,
    latexToMathJSON : latexToMathJSON,
    latexToPutdown : latex => mathJSONToPutdown( latexToMathJSON( latex ) ),
    latexToHTML : latex => MathLive.convertLatexToMarkup( latex )
} ) )
