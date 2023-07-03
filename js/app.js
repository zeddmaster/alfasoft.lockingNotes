define(['./amo.js', './base.js', './styleContainers.js', 'https://cdnjs.cloudflare.com/ajax/libs/jquery.maskedinput/1.4.1/jquery.maskedinput.min.js'], function(_AmoHelper, _BaseHelper, styleContainers){

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
                const phoneInput = $modal.find('input[name=phone]')

                if(phoneInput)
                    phoneInput.mask('+9 (999) 999-99-99')
                else
                    BaseHelper.log('not found find phone input :(')

                // enable Saving-button
                const saveBtn = $modal.find('.button-input-disabled')
                if(saveBtn)
                    saveBtn.removeClass('button-input-disabled')

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

                    this.denySections()
                    this.denyPipelines()
                    this.denyPipelineStatuses()
                    this.denyCardFields()
                })

                return true;
            },


            /**
             * Скрыть разделы
             */
            denySections(){

                const denyEntityMap = {
                    leads: ['leads', 'leads-pipeline'],
                    contacts: ['contacts'],
                    todo: ['todo', 'todo-line', 'todo-calendar'],
                    dashboard: ['dashboard'],
                    widgetsSettings: ['widgetsSettings'],
                    settings: ['settings'],
                    'settings-users': ['settings-users'],
                    'settings-communications': ['settings-communications'],
                    stats: ['stats'],
                    catalogs: ['catalogs'],
                    companies: ['companies'],
                    customers: ['customers']
                }

                let entity = AmoHelper.env('data.current_entity')
                let denyEntity = permissions?.denyEntity || []
                if(typeof denyEntity === 'string')
                    denyEntity = [denyEntity];

                if(~denyEntityMap.leads.indexOf(entity))
                    entity = 'leads'
                if(~denyEntityMap.todo.indexOf(entity))
                    entity = 'todo'
                if(entity === 'contacts')
                    entity = AmoHelper.env('data.element_type', 'contacts')

                if(denyEntity.length && denyEntityMap[entity] && ~denyEntity.indexOf(entity)){

                    const pageHolder = document.getElementById('page_holder')
                    const workArea = document.getElementById('work_area')
                    const cardHolder = document.getElementById('card_holder')

                    const lockElement = document.createElement('div')
                    lockElement.setAttribute('style', 'font-weight: bold; font-size: 20px; padding: 40px')
                    lockElement.innerHTML = "<div>Доступ к разделу запрещен</div>"

                    if(workArea) {
                        workArea.innerHTML = ''
                        workArea.appendChild(lockElement)
                    }
                    else if(pageHolder){
                        pageHolder.innerHTML = ''
                        pageHolder.appendChild(lockElement)

                        if(cardHolder)
                            cardHolder.style.display = 'none'
                    }
                }

                // hide menu items
                let selectors = [],
                    styles = ''
                denyEntity.forEach(i => {
                    denyEntityMap[i] && denyEntityMap[i].forEach(ii => {
                        if(ii === 'contacts') return
                        selectors.push(`[data-entity="${ii}"]`)
                    })
                })

                if(selectors.length)
                    styles = selectors.join(', ') + '{display: none !important;}'

                styleContainers.setContainer('entities', styles)
            },


            /**
             * Скрыть воронки
             */
            denyPipelines(){

                BaseHelper.log('run denyPipelines')
                const currentEntity = AmoHelper.env('data.current_entity')

                if(~['leads-pipeline', 'leads'].indexOf(currentEntity) && permissions.denyPipeline){

                    const pipelines = typeof permissions.denyPipeline === 'string' ? [permissions.denyPipeline] : permissions.denyPipeline

                    const noticeElement = document.createElement("div")
                    noticeElement.setAttribute('style', 'font-size: 20px; font-weight: bold; padding-left: 40px')
                    noticeElement.textContent = "Доступ к воронке ограничен"


                    if(currentEntity === 'leads'){
                        const currentPipelineID = AmoHelper.env('data.current_card.model.attributes.lead[PIPELINE_ID]')

                        if(currentPipelineID && ~pipelines.indexOf(currentPipelineID)){
                            const cardHolder = document.getElementById('card_holder')
                            const pageHolder = document.getElementById('page_holder')
                            if(cardHolder){
                                noticeElement.style.paddingTop = "40px"
                                cardHolder.style.display = 'none'
                                if(pageHolder)
                                    pageHolder.appendChild(noticeElement)
                            }
                        }
                    }
                    else if(currentEntity === 'leads-pipeline'){
                        const currentPipelineID = AmoHelper.env('data.current_view.current_pipeline.id')

                        // hide opened pipeline
                        if(currentPipelineID && ~pipelines.indexOf(currentPipelineID.toString())){
                            document.getElementById('pipeline_holder').remove()
                            const topBar = document.querySelector('.list__body-right__top');

                            // notice
                            if(topBar){
                                topBar.innerHTML = ""
                                topBar.appendChild(noticeElement)
                            }
                        }
                    }


                    // hide menu item
                    let selectors = [],
                        styles = ''
                    pipelines.forEach(p => selectors.push(`.aside .aside__list-item[data-id="${p}"]`))

                    if(selectors) styles = selectors.join(', ') + '{display:none!important;}'
                    styleContainers.setContainer('pipelines', styles)
                }
            },


            /**
             * Скрыть статусы воронки
             */
            denyPipelineStatuses(){

                BaseHelper.log('run denyPipelineStatuses')

                const entity = AmoHelper.env('data.current_entity')
                let pipeline_id = AmoHelper.env('data.current_view.current_pipeline.id')

                if(!pipeline_id)
                    pipeline_id = AmoHelper.env('data.current_card.model.attributes.lead[PIPELINE_ID]')

                if(permissions.denyPipelineStatus){

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
                        }
                    }

                }
            },


            /**
             * Блокировка полей сущности
             */
            denyCardFields(){
                BaseHelper.log('run denyCardFields')
                const entity = AmoHelper.env('data.current_entity')
                let styleSelectors = []

                // for base fields
                if(permissions.denyCustomField && permissions.denyCustomField[entity]){
                    let perms = permissions.denyCustomField[entity]
                    perms = typeof perms === 'string' ? [perms] : perms
                    perms.forEach(cf => {
                        styleSelectors.push(`.linked-form__field[data-id="${cf}"]`)
                    })
                }

                // for custom fields
                if(permissions.denyField && permissions.denyField[entity]){
                    let perms = permissions.denyField[entity]
                    perms = typeof perms === 'string' ? [perms] : perms
                    perms.forEach(bf => {
                        let selector
                        switch (bf){
                            case 'PRICE':
                                selector = '.linked-form__field.linked-form__field_budget'
                                break
                            case 'MAIN_USER':
                                selector = '.linked-form__field.linked-form__field_reassign'
                                break
                        }
                        selector && styleSelectors.push(selector)
                    })
                }

                // update style container
                let styles = ''
                if(styleSelectors.length)
                    styles = styleSelectors.join(', ') + "{display:none!important;}"
                styleContainers.setContainer('fields', styles)
            },

            dpSettings: function () { return true; },

            advancedSettings: function () {},

            destroy: function (){},

            onSave: function (configs) {
                BaseHelper.setupAccount(configs)
                return true;
            }
        }
    }
})