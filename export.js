
/**
 * This module installs into the editor a menu item for exporting Lurch document
 * content as LaTeX, which makes it handy for pasting into a LaTeX editor, such
 * as Overleaf.
 * 
 * @module Export
 */

import { Atom } from './atoms.js'
import { Shell } from './shells.js'
import { Dialog, LongTextInputItem, CheckBoxItem } from './dialog.js'
import { escapeLatex } from './utilities.js'
import { appSettings } from './settings-install.js'

// Internal use only
// The preamble that will be prefixed to any LaTeX document created by this
// module, if the user chooses to wrap the result in a document environment
const latexPreamble = `\\documentclass{article}

\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{amsthm}
\\usepackage{url}

\\newtheorem*{theorem}{Theorem}
\\newtheorem*{lemma}{Lemma}
\\newtheorem*{corollary}{Corollary}
\\newtheorem*{lurchrule}{Rule}
\\newtheorem*{axiom}{Axiom}
\\newtheorem*{definition}{Definition}
\\newtheorem*{recall}{Recall}

\\title{Lurch Document}
\\author{Lurch User}
\\date{\\today}

\\begin{document}
\\maketitle
`

// The corresponding ending text for the preamble above
const latexPostamble = `
\\end{document}`

// Internal use only
// Convert an HTML node (which can contain an entire document) to LaTeX,
// recursively
const htmlNodeToLatex = ( node, editor ) => {
    // Utility function for recurring on all children and joining their results
    const recur = () => Array.from( node.childNodes ).map( child =>
        htmlNodeToLatex( child, editor ) ).join( '' )
    // If it's an atom or shell, defer to that class's conversion method
    if ( Atom.isAtomElement( node ) ) {
        const atom = Atom.from( node, editor )
        appSettings.load()
        return !( atom instanceof Shell ) ? atom.toLatex()
             : appSettings.get( 'export LaTeX shells' ) ? atom.toLatex( recur() )
             : recur()
    }
    // If it's a text node, just use its (escaped and cleaned) contents
    if ( !node.tagName )
        return escapeLatex( node.textContent.replace( '\u00a0', ' ' ) ) // nbsp
    // If it's been centered, wrap it in a LaTeX center environment
    if ( node.style.textAlign == 'center' ) {
        node.style.textAlign = 'left'
        const withoutCentering = htmlNodeToLatex( node, editor )
        return `\n\\begin{center}\n${withoutCentering}\n\\end{center}\n`
    }
    // Handle the most common HTML tags that might show up in a Lurch document
    switch ( node.tagName.toLowerCase() ) {
        case 'br' : return '\n\\hfill\n\n'
        case 'hr' : return '\n\\hfill\n\\hrule\n\\hfill\n'
        case 'p' : return `\n\n${recur()}\n\n`
        case 'a' : return `\\href{${node.href}}{${recur()}}`
        case 'strong' : return `\\textbf{${recur()}}`
        case 'em' : return `\\textit{${recur()}}`
        case 'sup' : return `\\textsuperscript{${recur()}}`
        case 'sub' : return `\\textsubscript{${recur()}}`
        case 'code' : return `\\texttt{${recur()}}`
        case 'blockquote' : return `\\begin{quote}\n${recur()}\n\\end{quote}`
        case 'span' : return node.style.textDecoration == 'underline' ?
            `\\underline{${recur()}}` : recur()
        case 'ol' : return `\\begin{enumerate}\n${recur()}\n\\end{enumerate}`
        case 'ul' : return `\\begin{itemize}\n${recur()}\n\\end{itemize}`
        case 'li' : return `\\item ${recur()}`
        case 'h1' : return `\\section*{${recur()}}`
        case 'h2' : return `\\subsection*{${recur()}}`
        case 'h3' : return `\\subsubsection*{${recur()}}`
        case 'h4' :
        case 'h5' :
        case 'h6' : return `\\textbf{${recur()}}`
        default : return recur()
    }
}

// Internal use only
// The LaTeX code that comes out of the above function sometimes has some
// inelegant content, and this function smooths it out, as described below
const cleanUpLatex = latex => {
    // Trim each line and reduce many blank lines to just one
    latex = latex.replace( /[^\S\r\n]+\n/g, '\n' )
                 .replace( /\n[^\S\r\n]+/g, '\n' )
                 .replace( /\n\n\n+/g, '\n\n' )
    // A centering around an align is redundant
    latex = latex.replace( /\\begin{center}\n?\n?\\begin{align}/g, '\\begin{align}' )
                 .replace( /\\end{align}\n?\n?\\end{center}/g, '\\end{align}' )
    // Done
    return latex
}

/**
 * This function should be called in the editor's setup routine.  It installs
 * one feature into the editor:
 * 
 *  * a menu item for exporting the current document (or just the selection in
 *    it) as LaTeX, for pasting into a LaTeX editor, such as Overleaf
 * 
 * @param {tinymce.Editor} editor - the editor in which to install the feature
 *   described above
 * @function
 */
export const install = editor => {
    editor.ui.registry.addMenuItem( 'exportlatex', {
        icon : 'new-tab',
        text : 'Export as LaTeX...',
        tooltip : 'Export document or selection in LaTeX format',
        onAction : () => {
            // Compute the LaTeX versions of the whole document and of just the
            // user's current selection
            const offScreenDiv = document.createElement( 'div' )
            offScreenDiv.innerHTML = editor.getContent()
            const fullLatex = cleanUpLatex(
                htmlNodeToLatex( offScreenDiv, editor ) )
            offScreenDiv.innerHTML = editor.selection.getContent()
            const selectedLatex = cleanUpLatex(
                htmlNodeToLatex( offScreenDiv, editor ) )
            // Create a function that can compute the text to copy to the
            // clipboard, based on the above data, plus options the user will
            // specify via checkboxes in the dialog
            const latexToCopy = ( selectedOnly, addWrapper ) => {
                if ( selectedOnly && /^\s*$/.exec( selectedLatex ) )
                    return '(no text selected in document)'
                return ( addWrapper ? latexPreamble : '' )
                     + ( selectedOnly ? selectedLatex : fullLatex )
                     + ( addWrapper ? latexPostamble : '' )
            }
            // Create the dialog
            const dialog = new Dialog( 'Export as LaTeX', editor )
            dialog.json.size = 'medium'
            dialog.addItem( new CheckBoxItem(
                'selected', 'Convert only the selection' ) )
            dialog.addItem( new CheckBoxItem(
                'wrapper', 'Wrap the result in a document environment' ) )
            dialog.addItem( new LongTextInputItem( 'code',
                'Use the following code in your LaTeX document' ) )
            appSettings.load()
            dialog.setInitialData( {
                selected : appSettings.get( 'export LaTeX selection only' ),
                wrapper : appSettings.get( 'add LaTeX document wrapper' ),
                code : '' // see below
            } )
            dialog.removeButton( 'Cancel' )
            dialog.setDefaultFocus( 'code' )
            dialog.show()
            // Store the essential elements from the dialog in local variables
            const textarea = dialog.querySelector( 'textarea' )
            const checkBoxes = dialog.querySelectorAll( 'input[type="checkbox"]' )
            // Create an event handler that can populate the textarea with the
            // text to copy, highlight it, and scroll to the top
            const updateTextarea = () => setTimeout( () => {
                textarea.value = latexToCopy(
                    checkBoxes[0].checked, checkBoxes[1].checked )
                textarea.select()
                textarea.setAttribute( 'readonly', 'true' )
                textarea.setAttribute( 'rows', 15 )
                textarea.scrollTo( 0, 0 )
            } )
            // Update the text now, plus whenever the user changes options
            updateTextarea()
            checkBoxes.forEach( checkBox =>
                checkBox.addEventListener( 'change', updateTextarea ) )
        }
    } )
}

export default { install }
