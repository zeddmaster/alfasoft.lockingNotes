define(['./amo.js', './base.js', './styleContainers.js'], function(_AmoHelper, _BaseHelper, styleContainers){

    let instance = null

    return function(widget){

        // Save instance
        instance = widget

        // Get instances
        const AmoHelper = new _AmoHelper(widget)
        const BaseHelper = new _BaseHelper(widget)


        let permissions,
            waitPermissions = null


        this.callbacks = {

            // Render setting's page
            settings: function ($modal) {
                return true;
            },


            // Init app
            init: function () {
                return true;
            },


            /**
             * Экшины страницы настроек
             * @returns {boolean}
             */
            bind_actions: function () {

                // Settings handler
                // > render setting template
                // > save settings
                const userFormHandler = e => {

                    // check target
                    let targetEntity = e.target.closest('.list-user_rights'),
                        target = e.target.closest('.list-row.js-list-row'),
                        userModalForm

                    // declare timer
                    let settingsWaitTimer,
                        timerCounter = 0


                    // wait for modal user form
                    if(targetEntity && target) {

                        const IntervalDelay = 100
                        settingsWaitTimer = setInterval(() => {
                            if(timerCounter > 15) // timeout
                                return clearInterval(settingsWaitTimer)

                            timerCounter++

                            // finding user modal form
                            userModalForm = document.getElementById('modal_add_user_form')
                            if(!userModalForm)
                                return // wait some more

                            clearInterval(settingsWaitTimer) // <-- waited!
                            if(document.querySelector('.alfa-blocker'))
                                return;

                            // step: create widget wrapper
                            const widgetWrapper = document.createElement('div')
                            widgetWrapper.classList.add('alfa-blocker')
                            widgetWrapper.innerHTML = "Виджет блокировки доступа: загрузка"
                            userModalForm.parentElement.append(widgetWrapper)

                            // step: find user id
                            const anyUserBlock = userModalForm.querySelector('.b-user__block[data-id]')
                            if(!anyUserBlock) return

                            const user_id = anyUserBlock.getAttribute('data-id')
                            if(!user_id) return

                            // step: get settings and render template
                            AmoHelper.getSettingsTemplateParams(user_id).then(params => {
                                AmoHelper.getTemplate('settings').then(template => {
                                    widgetWrapper.innerHTML = template.render(params)
                                })
                            })


                            // ----------------------- //
                            // --- [save settings] --- //
                            userModalForm.addEventListener('pointerup', event => {
                                const targetBtn = event.target.closest('#save_user_rights')
                                if(!targetBtn || targetBtn.classList.contains('button-input-disabled')) return

                                // step: find form and get data
                                const settingsForm = document.getElementById('alfa-blocker__user-settings-form')
                                if(!settingsForm) return BaseHelper.log('unable to save settings: form not found', { settingsForm })
                                const formData = new FormData(settingsForm)

                                // prepare permissions to saving
                                let permissionsToSave = BaseHelper.formDataToJSON(formData)
                                BaseHelper.log('permissions to saving', {permissionsToSave})

                                permissions = undefined // clear permissions cache
                                BaseHelper.saveUserPermissions(user_id, permissionsToSave)
                            })


                        }, IntervalDelay)
                    }
                } // userFormHandler
                document.body.removeEventListener('pointerup', userFormHandler) // fix bug retries
                document.body.addEventListener('pointerup', userFormHandler)


                // clear base handler of submit settings form
                document.body.addEventListener('submit', e => {
                    if(e.target.id === 'alfa-blocker__user-settings-form') {
                        e.preventDefault()
                        e.stopPropagation()
                        BaseHelper.log('def handler deny')
                    }
                })


                return true;
            },



            /**
             * Применение настроек блокировки
             * @returns {boolean}
             */
            render: function () {


                // -- notes -- //
                /*if(AmoHelper.env('data.current_entity') === 'settings-users'){
                    BaseHelper.log('this is user settings')
                }*/
                // ----------- //


                // Проверить - загружены ли настройки доступа
                const permissionsPromise = new Promise(r => {
                    if(permissions === undefined) // если настройки не получены - получить и применить
                        BaseHelper.getUserPermissions(AmoHelper.getCurrentUserId()).then(p => {
                            permissions = p || {}
                            r()
                        })
                    else // иначе - применить сразу
                        r()
                })


                // Непосредственно, применение настроек блокировки
                permissionsPromise.then(() => {

                    // log and check
                    BaseHelper.log('current permissions', { permissions })
                    if(!permissions) return

                    // current entity
                    const currentPipelineID = AmoHelper.env('data.current_view.current_pipeline.id')
                    const currentEntity = AmoHelper.env('data.current_entity')

                    // [ENTITY:lead-pipeline] deny pipelines
                    if(currentEntity === 'leads-pipeline' && permissions.denyPipeline) {
                        if(currentPipelineID && ~permissions.denyPipeline.indexOf(currentPipelineID.toString())){
                            document.getElementById('pipeline_holder').remove()
                            document.querySelector('.list__body-right__top').innerHTML = "Воронка не доступна"
                        }
                    }

                    // deny pipeline statuses
                    this.denyPipelineStatuses()

                    // deny customFields
                    this.denyCardFields()

                })

                return true;
            },


            denyPipelines(){
                const currentPipelineID = AmoHelper.env('data.current_view.current_pipeline.id')
                const currentEntity = AmoHelper.env('data.current_entity')
            },


            denyPipelineStatuses(){
                const entity = AmoHelper.env('data.current_entity')
                let pipeline_id = AmoHelper.env('data.current_view.current_pipeline.id')

                if(!pipeline_id)
                    pipeline_id = AmoHelper.env('data.current_card.model.attributes.lead[PIPELINE_ID]')

                if(permissions.denyPipelineStatus){

                    BaseHelper.log('denyPipelineStatuses handler', {pipeline_id, permissions: permissions.denyPipelineStatus})

                    let pipelineStatuses = (typeof permissions.denyPipelineStatus === 'string')
                        ? [permissions.denyPipelineStatus] : permissions.denyPipelineStatus

                    // for pipeline view
                    if(pipelineStatuses[pipeline_id]){
                        let statuses = pipelineStatuses[pipeline_id]
                        if(typeof statuses === 'string') statuses = [statuses];

                        let styleSelector = []
                        statuses.forEach(status => {
                            styleSelector.push(`.pipeline_cell-${status}`)
                            styleSelector.push(`ul.pipeline-select__dropdown input[value="${status}"] + label`)
                        })

                        if(styleSelector.length){
                            styleContainers.setContainer('pipelineStatuses', styleSelector.join(', ') + "{display: none !important;}")
                                .syncDOM('pipelineStatuses')
                        }
                    }

                }
            },


            /**
             * Блокировка полей сущности
             * @param options
             */
            denyCardFields(options){
                options = options || {}
                const currentEntity = options.entity || AmoHelper.env('data.current_entity')
                const selectorWrap = options.wrap || '#card_fields'

                if(AmoHelper.env('data.current_card')) {
                    if(permissions.denyCustomField && permissions.denyCustomField[currentEntity]){
                        if(typeof permissions.denyCustomField[currentEntity] === 'string')
                            permissions.denyCustomField[currentEntity] = [permissions.denyCustomField[currentEntity]]

                        permissions.denyCustomField[currentEntity].forEach(denyCF_ID => {
                            const customField = document.querySelector(`${selectorWrap} [name^="${denyCF_ID}"]`)
                            if(customField) {
                                const customFieldWrapper = customField.closest('.linked-form__field')
                                if(customFieldWrapper)
                                    customFieldWrapper.style.display = 'none'
                            }
                        })
                    }

                    // lead inner entities
                    // блокировка вложенных сущностей
                    // например внутри сделки есть поля компании и поля контакта
                    if(currentEntity === 'leads') {
                        this.denyCardFields({entity: 'contacts', wrap: '#contacts_list'})
                        this.denyCardFields({entity: 'companies', wrap: '#companies_list'})
                    }

                }
            },

            dpSettings: function () { return true; },

            advancedSettings: function () {},

            destroy: function (){},

            onSave: function () {
                return true;
            }
        }
    }
})