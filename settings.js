
// This file is a rough draft.  This is not its final version.
// The ideas expressed below will be reorganized into a class.


// Setting types supported so far:
//
// Type     Attributes                                                  Widget
// ----     ----------                                                  ------
// note     id:string, style:info|warn|error|success|(none), text:HTML  alertbanner/htmlpanel
// bool     id:string, label:string, value:bool                         checkbox
// color    id:string, label:string, value:string                       colorinput/colorpicker
// text     id:string, label:string, value:string                       input
// category id:string, label:string, options:string[], value:string     selectbox
//
// Could later add slider, textarea, and possibly 1-2 others.

const mainSchema = [
    {
        category : 'Test category 1',
        contents : [
            {
                type : 'note',
                id : 'example note 1',
                style : 'info',
                text : 'I don\'t really think we should be putting full paragraphs in here.'
            },
            {
                type : 'bool',
                id : 'example checkbox',
                label : 'Frizzles enabled',
                value : false
            },
            {
                type : 'color',
                id : 'example color',
                label : 'Color of frizzle borders',
                value : 'red'
            }
        ]
    },
    {
        category : 'Test category 2',
        contents : [
            {
                type : 'note',
                id : 'example note 2',
                text : 'You can do <strong>STRONG</strong> but that\'s about it.'
            },
            {
                type : 'text',
                id : 'example text input',
                label : 'Name your favorite frizzle',
                value : 'Henry'
            },
            {
                type : 'category',
                id : 'example categorical input',
                label : 'Hours per day to work the frizzles',
                options : [ 2, 4, 6, 8, 10 ],
                value : 8
            }
        ]
    }
]

const mainValues = { }
mainSchema.forEach( category =>
    category.contents.forEach( setting =>
        mainValues[setting.id] = localStorage.getItem( setting.id ) || setting.value ) )

export const show = (
    editor = tinymce.activeEditor, title = 'Settings',
    schema = mainSchema, values = mainValues
) => new Promise( ( resolve, reject ) => {
    const initialData = { }
    const tabs = [ ]
    schema.forEach( ( category, index ) => {
        const tab = {
            name : `tab${index+1}`,
            title : category.category,
            items : [ ]
        }
        category.contents.forEach( setting => {
            if ( setting.type != 'note' ) {
                initialData[setting.id] = values.hasOwnProperty( setting.id ) ?
                    values[setting.id] : setting.value
                if ( setting.type == 'bool' )
                    initialData[setting.id] = ( initialData[setting.id] === true
                                             || initialData[setting.id] === 'true' )
                else
                    initialData[setting.id] = `${initialData[setting.id]}`
            }
            switch ( setting.type ) {
                case 'note':
                    if ( [ 'info', 'warn', 'error', 'success' ].includes( setting.style ) )
                        tab.items.push( {
                            type : 'alertbanner',
                            level : setting.style,
                            text : setting.text,
                            icon : {
                                info : 'info',
                                warn : 'warning',
                                error : 'notice',
                                success : 'selected'
                            }[setting.style]
                        } )
                    else
                        tab.items.push( {
                            type : 'htmlpanel',
                            html : setting.text
                        } )
                    break
                case 'bool':
                    tab.items.push( {
                        type : 'checkbox',
                        name : setting.id,
                        label : setting.label
                    } )
                    break
                case 'color':
                    tab.items.push( {
                        type : 'colorinput',
                        name : setting.id,
                        label : setting.label
                    } )
                    break
                case 'text':
                    tab.items.push( {
                        type : 'input',
                        name : setting.id,
                        label : setting.label
                    } )
                    break
                case 'category':
                    tab.items.push( {
                        type : 'selectbox',
                        name : setting.id,
                        label : setting.label,
                        items : setting.options.map( option => {
                            return { value : `${option}`, text : `${option}` }
                        } )
                    } )
                    break
            }
        } )
        tabs.push( tab )
    } )
    const dialog = editor.windowManager.open( {
        title : title,
        body : {
            type : 'tabpanel',
            tabs : tabs
        },
        buttons : [
            { text : 'OK', type : 'submit' },
            { text : 'Cancel', type : 'cancel' }
        ],
        initialData : initialData,
        onSubmit : () => {
            Object.assign( values, dialog.getData() )
            if ( values == mainValues )
                Object.keys( values ).forEach( key =>
                    localStorage.setItem( key, values[key] ) )
            resolve( values )
            dialog.close()
        },
        onCancel : reject
    } )
} )

window.showSettings = show
