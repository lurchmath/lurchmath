
/**
 * In a Lurch document, certain sections will be marked as "shells."  These will
 * always be DIVs and will typically contain other document content.  While
 * {@link module:Atoms atoms (as defined in the Atoms module)} are indivisible
 * sections of special, meaningful document content, shells are also special,
 * meaningful document content, but are not indivisible.  They are intended to
 * contain other document content.
 * 
 *  1. The user can edit what sits inside a shell, but the application
 *     determines how the shell is drawn as a visual wrapper around that
 *     content.
 *  2. The user can edit the shells's properties by clicking on it (the visual
 *     boundary around the content, not the content itself) and interacting with
 *     whatever dialog the application pops up in response.
 *  3. There can be many different types of shells.  For example, a theorem
 *     statement may be one type, and a proof or subproof may be another.
 *  4. Like atoms, each shell will typically have some meaning that will be
 *     important when the document is processed in a mathematical way.
 * 
 * Shells are implemented as a subclass of Atoms, overriding some functions in
 * the {@link Atom Atom class} that must be done in a different way for shells,
 * and adding new functions that apply only to Shells.
 * 
 * This module contains tools for working with shells, including the
 * {@link module:Shells.install function} we use to install their
 * mouse event handlers and, most importantly, the
 * {@link module:Shells.Shell class} we use to create an API for working with
 * individual shells.
 *
 * @module Shells
 * @see {@link module:Atoms the Atoms module}
 */

import { getHeader } from './header-editor.js'
import { onlyBefore, isOnScreen } from './utilities.js'
import { Atom, className as atomClassName } from './atoms.js'
import { addAutocompleteFunction } from './auto-completer.js'
import { Dialog, SelectBoxItem } from './dialog.js'
import { Environment }
    from 'https://cdn.jsdelivr.net/gh/lurchmath/lde@master/src/index.js'

/**
 * For information about the concept of shells in Lurch in general, see the
 * documentation of {@link module:Shells the Shells module}.  Because Shells are
 * a type of {@link Atom}, much of their API comes from the {@link Atom} class.
 * This subclass changes a few of the base implementations and adds a few new
 * function specific to shells.
 * 
 * As with atoms, one constructs an instance of this class by passing the
 * corresponding HTML element from the editor, along with the editor itself, and
 * the resulting object provides an extensive API (documented below and in the
 * {@link Atom Atom class}) for interfacing with the shell in a variety of ways
 * useful for the Lurch app.
 */
export class Shell extends Atom {

    static subclassName = Atom.registerSubclass( 'shell', Shell )

    /**
     * Assign this shell a specific subclass, by name.  You must assign a
     * subclass by name, using one of the names registered using
     * {@link module:Atoms.Atom.registerSubclass registerSubclass()}, and that
     * subclass must be a subclass of {@link module:Shells.Shell Shell}.  This
     * routine stores the subclass in the shell, updates any other related
     * information (e.g., how the shell is displayed), and returns a new
     * instance of the {@link module:Atoms.Atom Atom} class, specifically of the
     * named subclass, for this shell.
     * 
     * @param {string} subclassName - the name of the subclass to assign
     * @returns {Shell} an instance of the given subclass, representing this
     *   same shell
     */
    setSubclass ( subclassName ) {
        const subclass = Atom.subclasses.get( subclassName )
        if ( subclass != Shell && !( subclass.prototype instanceof Shell ) )
            throw new Error( `${subclassName} is not a subclass of Shell` )
        this.setMetadata( 'type', subclassName )
        const result = Atom.from( this.element, this.editor )
        this.element.dataset['shell_title'] = result.getTitle()
        return result
    }

    /**
     * Every shell may provide a title to decorate the top of its DIV, on the
     * left-hand side.  This is optional.  The default is the name of the class,
     * in title case, followed by a colon.  Subclasses may override this, e.g.,
     * by returning the empty string to remove the title entirely.
     * 
     * @returns {string} the title to use at the top of the shell, when displayed
     *   in the document
     */
    getTitle () {
        const name = this.getMetadata( 'type' )
        return name[0].toUpperCase() + name.substring( 1 ) + ':'
    }

    /**
     * The default way to convert a Shell to LCs is to represent it as a single
     * Environment.  Subclasses may override this implementation as needed.
     * This functionality is used by {@link Message.document the conversion
     * function} of the whole document into LCs for validation.
     * 
     * Note that this does not add any of its child atoms to itself as LCs.
     * The conversion is done by the function referenced above, which takes care
     * to give each LC a unique ID, post-process the conversion to respect
     * various conventions, etc.
     * 
     * @returns {LogicConcept[]} an array containing exactly one Environment
     *   instance, representing this shell, with no children
     * @see {@link Shell#finalizeChildLCs finalizeChildLCs()}
     */
    toLCs () { return [ new Environment() ] }

    /**
     * After converting a shell to LCs using {@link Shell#toLCs toLCs()}, its
     * children (if any) will be created and added to it.  Specifically, we
     * expect that {@link Shell#toLCs toLCs()} will return a single environment,
     * to which children will be added.  Then this function will be called on
     * that same environment object, allowing the shell to tweak attributes of
     * its children to respect the meaning of the shell itself.  For example, if
     * the shell implies that any child environments should be givens, it can
     * make them so.
     * 
     * This default implementation does nothing.  Subclasses may override it.
     * 
     * @param {LogicConcept} shellLC - the Environment LC represneting this shell
     * @see {@link Shell#toLCs toLCs()}
     */
    finalize ( shellLC ) { }

    /**
     * Opens a dialog for editing the shell.  It provides a drop-down list for
     * choosing which subclass of shell this one is, so that when we use shells
     * to implement common mathematical concepts (e.g., Theorem, Proof, Rule,
     * etc.) the user will automatically have a way to convert among those types
     * of document structure.
     * 
     * Note: If the application has no proper subclasses of {@link Shell}
     * installed, this function will do nothing and return a Promise that
     * immediately resolves to false.
     * 
     * @returns {Promise} a promise that resolves to `true` if the user
     *   clicked OK in the dialog, or `false` if the user clicked Cancel
     */
    edit () {
        const dialog = new Dialog( 'Edit environment', this.editor )
        const shellSubclassNames = Array.from( Atom.subclasses.keys() ).filter(
            name => Atom.subclasses.get( name ).prototype instanceof Shell )
        if ( shellSubclassNames.length == 0 )
            return Promise.resolve( false )
        dialog.addItem( new SelectBoxItem(
            'shellSubclass', 'Type of environment', shellSubclassNames ) )
        dialog.setDefaultFocus( 'shellSubclass' )
        dialog.setInitialData( { shellSubclass : this.getMetadata( 'type' ) } )
        return dialog.show().then( userHitOK => {
            if ( !userHitOK ) return false
            this.setSubclass( dialog.get( 'shellSubclass' ) )
            return true
        } )
    }

    /**
     * Override the default implementation, which uses a child element, to
     * instead place the validation result in an attribute of the element,
     * where it can be found and respected by CSS.
     *
     * @see {@link module:Atoms.Atom#setValidationResult
     * setValidationResult() for Atoms}
     */
    setValidationResult ( result, reason ) {
        if ( !result ) {
            delete this.element.dataset['validation_result']
            this.setHoverText( null )
        } else {
            this.element.dataset['validation_result'] = result
            this.setHoverText( reason )
        }
    }

    /**
     * Creating shells is not the same as creating atoms:
     * 
     *  - the user cannot choose to use a SPAN element to represent a shell
     *  - the contents of a shell remain `contenteditable:true`
     *  - the shell must have some default content, which can be replaced later
     *
     * @param {tinymce.Editor} editor - the editor in which to create the shell
     * @param {string} subclassName - the name of the subclass of {@link Shell}
     *   to be represented by this element (defaults to `'shell'`)
     * @see {@link module:Atoms.Atom.createElement createElement() for Atoms}
     */
    static createElement ( editor, subclassName='shell' ) {
        const result = new Shell( Atom.createElement( editor, 'div' ) )
        result.element.removeAttribute( 'contenteditable' )
        result.setSubclass( subclassName )
        result.element.innerHTML = `<p><br data-mce-bogus="1"></p>`
        return result.element
    }

    /**
     * Accessibility of HTML nodes sitting inside a hierarchy of Shells is
     * analogous to accessibility of `MathConcept` or `LogicConcept` instances
     * inside their own hierarchy.  The shells create the hierarchy/tree and the
     * HTML nodes within them act as leaves of the tree.
     * 
     * Of course, one HTML node is not accessible to another if it comes later
     * in the document, so this function assumes that you are asking about
     * accessibility of an earlier node to a later node.  It does not check to
     * be sure that this is true; the client must ensure that.
     * 
     * It returns true if the `earlier` node is accessible to the `later` node.
     * 
     * @param {Node} earlier - the earlier of the two DOM nodes to compare
     * @param {Node} later - the later of the two DOM nodes to compare
     * @param {tinymce.Editor} - the editor in which these nodes sit
     * @returns {boolean} whether the `earlier` node is accessible to the
     *   `later` node
     */
    static isAccessibleTo ( earlier, later, editor ) {
        let walk1 = earlier
        let walk2 = later
        while ( walk1 ) {
            if ( !walk2 ) return false
            walk1 = Atom.findAbove( walk1.parentNode, editor )
            walk2 = Atom.findAbove( walk2.parentNode, editor )
            if ( walk1 && ( walk1 !== walk2 ) ) return false
        }
        return true
    }

    /**
     * For the meaning of accessibility, see
     * {@link module:Shells.Shell.isAccessibleTo isAccessibleTo()}.
     * This function returns the array of all HTML nodes that are accessible to
     * the given `target` in the given `editor`, as long as they have the given
     * `className` and satisfy the given `predicate`.  HTML nodes that appear in
     * dependencies and in the document header are also included.  All nodes are
     * returned in the order that they appear in the document (counting the
     * header as earliest).
     * 
     * The predicate can be omitted and defaults to an accessibility check
     * relative to the given `target` node.  The class name can be omitted and
     * defaults to the class name used to mark nodes as being part of the
     * {@link module:Atoms.Atom Atoms module}.
     * 
     * @param {tinymce.Editor} editor - the editor in which to search
     * @param {Node} target - the node to use for filtering the result list
     * @param {Function?} predicate - a function that takes a node and returns
     *   true if that node should be included in the results
     * @param {string?} className - the class name of the nodes to include
     * @returns {Node[]} the ordered array of accessible nodes satisfying all of
     *   the given criteria
     */
    static accessibles (
        editor, target, predicate = null, className = atomClassName
    ) {
        if ( !predicate )
            predicate = node => Shell.isAccessibleTo( node, target, editor )
        return [
            // dependencies in header:
            ...( getHeader( editor )?.querySelectorAll( `.${className}` ) || [ ] ),
            // nodes in document preceding target:
            ...onlyBefore( editor.dom.doc.querySelectorAll( `.${className}` ), target )
        ].filter( isOnScreen ).filter( predicate )
    }

}

/**
 * This function should be called in the editor's setup routine.  It installs
 * several things into the editor:
 * 
 *  * a menu item for inserting "environments" (untyped shells)
 *  * an event handler for deleting empty environments (which can occur if the
 *    user creates an environment, leaves it empty, and then positions their
 *    cursor after it and hits backspace---a corner case, but still one we must
 *    handle correctly)
 *  * two menu items for inserting blank paragraphs before and after the current
 *    block, so that the user does not get stuck unable to move their cursor
 *    after the last shell in the document, or before the first, or between two
 *    adjacent ones
 *  * an autocompleter shortcut that replaces `\{` with an "environment" (an
 *    untyped shell)
 * 
 * @param {tinymce.Editor} editor - the editor in which to install the features
 *   described above
 * @function
 */
export const install = editor => {
    // The first menu item described above
    // (We do not call it "insert environment" because it will go on the insert
    // menu, so it just needs the word "Environment")
    editor.ui.registry.addMenuItem( 'environment', {
        icon : 'unselected',
        text : 'Environment',
        tooltip : 'Insert block representing an environment',
        shortcut : 'Meta+Shift+E',
        onAction : () => {
            const content = editor.selection.getContent()
            const element = Shell.createElement( editor )
            Atom.from( element, editor ).editThenInsert()
        }
    } )
    // The event handler for the corner case described above
    editor.on( 'NodeChange keyup', () => {
        Array.from(
            editor.dom.doc.querySelectorAll( `.${Atom.className}` )
        ).forEach( element => {
            if ( element.dataset.has( 'shell_title' )
              && !element.querySelector( 'p' ) )
                element.remove()
        } )
    } )
    // The two actions for inserting blank paragraphs, described above
    // (Same comments apply as given above, re: Insert menu and naming)
    editor.ui.registry.addMenuItem( 'paragraphabove', {
        text : 'Empty paragraph above',
        tooltip : 'Insert an empty paragraph above the current block',
        shortcut : 'Meta+Shift+Enter',
        onAction : () => {
            for ( let walk = editor.selection.getStart()
                ; walk
                ; walk = walk.parentNode )
            {
                if ( walk.parentNode && walk.tagName == 'DIV' ) {
                    const newPara = editor.dom.doc.createElement( 'p' )
                    newPara.innerHTML = '<br data-mce-bogus="1">'
                    walk.parentNode.insertBefore( newPara, walk )
                    editor.selection.setCursorLocation( newPara, 0 )
                    editor.focus()
                    return
                }
            }
        }
    } )
    editor.ui.registry.addMenuItem( 'paragraphbelow', {
        text : 'Empty paragraph below',
        tooltip : 'Insert an empty paragraph below the current block',
        shortcut : 'Meta+Enter',
        onAction : () => {
            for ( let walk = editor.selection.getStart()
                ; walk
                ; walk = walk.parentNode )
            {
                if ( walk.parentNode && walk.tagName == 'DIV' ) {
                    const newPara = editor.dom.doc.createElement( 'p' )
                    newPara.innerHTML = '<br data-mce-bogus="1">'
                    walk.parentNode.insertBefore( newPara, walk.nextSibling )
                    editor.selection.setCursorLocation( newPara, 0 )
                    editor.focus()
                    return
                }
            }
        }
    } )
    // The user can insert an environment using an autocompleter:
    addAutocompleteFunction( editor => {
        const shellSubclassNames = Array.from( Atom.subclasses.keys() ).filter(
            name => Atom.subclasses.get( name ).prototype instanceof Shell )
        shellSubclassNames.forEach( subclassName => {
            const subclass = Atom.subclasses.get( subclassName )
            if ( !subclass.hasOwnProperty( 'defaultHTML' ) ) {
                const element = Shell.createElement( editor, subclassName )
                element.innerHTML = '<p></p>'
                subclass.defaultHTML = element.outerHTML
            }
        } )
        return shellSubclassNames.map( subclassName => {
            const subclass = Atom.subclasses.get( subclassName )
            return {
                shortcut : subclassName.toLowerCase(),
                preview : `${subclassName} environment`,
                content : subclass.defaultHTML
            }
        } )
    } )
}

/**
 * A rule is a type of shell with the following features.
 * 
 *  - It labels itself as a "rule" using the attribute the LDE respects for
 *    rules of inference, so that validation will treat it as one.
 *  - It marks itself as a given, which the LDE requires for rules.
 *  - It marks any child environment as a given, because that is (almost?)
 *    always what should be the case for any environment inside a rule, since it
 *    is almost certainly a subproof that the user must provide in order to use
 *    the rule.
 */
export class Rule extends Shell {
    static subclassName = Atom.registerSubclass( 'rule', Rule )
    finalize ( shellLC ) {
        shellLC.makeIntoA( 'given' )
        shellLC.makeIntoA( 'Rule' )
        shellLC.children().forEach( child => {
            if ( child instanceof Environment ) child.makeIntoA( 'given' )
        } )
    }
}

/**
 * A definition is a type of shell that functions exactly like a {@link Rule},
 * except has the word "Definition" on top instead of "Rule".
 */
export class Definition extends Rule {
    static subclassName = Atom.registerSubclass( 'definition', Definition )
}    

/**
 * An axiom is a type of shell that functions exactly like a {@link Rule},
 * except has the word "Axiom" on top instead of "Rule".
 */
export class Axiom extends Rule {
    static subclassName = Atom.registerSubclass( 'axiom', Axiom )
}

/**
 * A theorem is a type of shell with the following features.
 * 
 *  - It labels itself as a "theorem" using the attribute the LDE respects for
 *    theorem statements, so that validation will treat it as one.
 *  - It marks any child environment as a given, because that is (almost?)
 *    always what should be the case for any environment inside a rule, since it
 *    is almost certainly a subproof that the user must provide in order to use
 *    the theorem.
 */
export class Theorem extends Shell {
    static subclassName = Atom.registerSubclass( 'theorem', Theorem )
    finalize ( shellLC ) {
        shellLC.makeIntoA( 'theorem' )
        shellLC.children().forEach( child => {
            if ( child instanceof Environment ) child.makeIntoA( 'given' )
        } )
    }
}

/**
 * A lemma is a type of shell that functions exactly like a {@link Theorem},
 * except has the word "Lemma" on top instead of "Theorem".
 */
export class Lemma extends Theorem {
    static subclassName = Atom.registerSubclass( 'lemma', Lemma )
}

/**
 * A corollary is a type of shell that functions exactly like a {@link Theorem},
 * except has the word "Corollary" on top instead of "Theorem".
 */
export class Corollary extends Theorem {
    static subclassName = Atom.registerSubclass( 'corollary', Corollary )
}

/**
 * A proof is a type of shell that has the word "Proof" on top and no other
 * special functionality.  The LDE will treat it as a container with things
 * inside that should be validated.
 */
export class Proof extends Shell {
    static subclassName = Atom.registerSubclass( 'proof', Proof )
}

/**
 * A subproof is a type of shell that has no title on top and no other
 * special functionality.  It can be used inside proofs to group collections of
 * subderivations together, but without adding the unnecessary (and confusing)
 * heading "Proof" on top of them, which would be the case if we were instead
 * to use the {@link Proof} class.
 */
export class Subproof extends Shell {
    static subclassName = Atom.registerSubclass( 'subproof', Subproof )
    getTitle () { return '' }
}

/**
 * A "recall" is a type of shell with the following features.
 * 
 *  - It labels itself as a "hint" using the attribute the LDE respects for
 *    hints, so that validation will treat it as one.  A hint is an instantiation
 *    of a rule of inference, which can help the LDE not have to figure out how
 *    to find the instantiation on its own.  This can be useful for some rules
 *    that are very time consuming to instantiate in all possibly relevant ways.
 *  - It marks any child environment as a given, because it should be parallel
 *    with the {@link Rule} it's trying to instantiate, and rules make their
 *    child environments given.
 */
export class Recall extends Shell {
    static subclassName = Atom.registerSubclass( 'recall', Recall )
    finalize ( shellLC ) {
        shellLC.makeIntoA( 'hint' )
        shellLC.children().forEach( child => {
            if ( child instanceof Environment ) child.makeIntoA( 'given' )
        } )
    }
}

export default { Shell, install }
