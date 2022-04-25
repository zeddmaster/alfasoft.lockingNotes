define(['./base.js'], function(_baseHelper){
    let instance = null,
        baseHelper = null

    return function(widget){
        instance = widget || null;
        baseHelper = new _baseHelper(instance)

        return {

            // get current user's id
            getCurrentUserId(){
                return instance.system().amouser_id
            },

            // get twig template
            getTemplate(template){
                return instance.render({
                    href: '/templates/' + template + '.twig',
                    base_path: instance.params.path,
                    v: instance.get_version(),
                    promised: true
                });
            },


            // get pipelines with statuses
            getPipelines(options){
                options = options || {}

                return new Promise(resolve => {
                    baseHelper.httpRequest('/api/v4/leads/pipelines')
                        .then(response => {
                            const pipelines = response?._embedded?.pipelines || []
                            let denyPS = {}

                            // process permissions
                            if(options?.permissions?.denyPipelineStatus)
                                denyPS = options.permissions.denyPipelineStatus

                            // format statuses
                            if(pipelines.length) pipelines.map(pipeline => {
                                if(pipeline._embedded.statuses) pipeline._embedded.statuses.forEach( (status, index) => {
                                    pipeline._embedded.statuses[index] =  {
                                        id: status.id,
                                        option: status.name,
                                        name: `denyPipelineStatus[${pipeline.id}]`,
                                        is_checked: denyPS[pipeline.id] && ~denyPS[pipeline.id].indexOf(status.id.toString()) // mark checked
                                    }
                                })
                            })

                            resolve(pipelines)
                        })
                })
            },



            // get custom-fields of entity
            getCustomFields(entity, options){
                options = options || {}

                return new Promise((resolve, reject) => {

                    // check entity
                    if(!~['leads', 'contacts', 'companies', 'customers'].indexOf(entity))
                        reject(baseHelper.log('entity not supported'))

                    const singleEntityName = this.entitySingle(entity)

                    baseHelper.httpRequest(`/api/v4/${entity}/custom_fields`).then(response => {
                        let customFields = response?._embedded?.custom_fields || []

                        // add base fields
                        if(entity === 'leads')
                            customFields.unshift({ id: 'PRICE', twig_id: 'lead[PRICE]', name: 'Бюджет' })
                        customFields.unshift({ id: 'MAIN_USER', twig_id: `${singleEntityName}[MAIN_USER]`, name: 'Ответственный' })

                        if(options.twig)
                            customFields = this.customFieldsForTwig(entity, customFields)

                        resolve(customFields)
                    }).catch(() => resolve([]))
                })
            },

            // customFields to twig format
            customFieldsForTwig(entity, custom_fields){
                custom_fields.forEach((field, index) => {
                    custom_fields[index] = {
                        id: field.twig_id || `CFV[${field.id}]`,
                        option: field.name,
                        name: `denyCustomField[${entity}]`
                    }
                })
                return custom_fields
            },

            // get all custom fields by entities
            getCustomFieldsByEntities(options){
                options = options || {}
                return new Promise(resolve => {
                    const entities = ['leads', 'contacts', 'companies', 'customers']
                    let custom_fields = {}
                    entities.forEach(entity => {
                        this.getCustomFields(entity, options).then(cf => {
                            custom_fields[entity] = cf
                            if(Object.values(custom_fields).length === entities.length)
                                resolve(custom_fields)
                        })
                    })
                })
            },

            // get settings template parameters
            getSettingsTemplateParams(user_id){
                user_id = user_id || this.getCurrentUserId()

                return new Promise(resolve => {
                    let params = {}

                    // get Custom fields
                    this.getCustomFieldsByEntities({ twig: true }).then(custom_fields => {
                        params.custom_fields = custom_fields || {}

                        // get permissions
                        baseHelper.getUserPermissions(user_id).then(permissions => {
                            params.permissions = permissions || {}

                                // Get pipelines
                                this.getPipelines({ permissions }).then(pipelines => {
                                    params.pipelines = pipelines || []

                                // set deny custom fields
                                this.setDenyCustomFields(params.custom_fields, permissions)

                                resolve(params)
                            })
                        })
                    })
                })
            },


            /**
             * Отметить заблокированные поля
             * для settings.twig
             * @param customFields
             * @param permissions
             */
            setDenyCustomFields(customFields, permissions){
                const denyCF = permissions.denyCustomField

                baseHelper.log({customFields, permissions})
                if(!denyCF) return baseHelper.log(`permissions for custom fields not found'`, denyCF)

                for(let entity in customFields){
                    if(!denyCF[entity]) continue
                    const entityCustomFields = customFields[entity]
                    entityCustomFields.forEach(i => {
                        i.is_checked = ~denyCF[entity].indexOf(i.id)
                    })
                }
            },



            entitySingle(entitiesName){
                const entities = {
                    companies: 'company',
                    leads: 'lead',
                    contacts: 'contact',
                    customers: 'customer'
                }

                return entities[entitiesName] || ''
            },



            // get data from AMOCRM storage
            // Example: env('data.current_entity')
            env(key){
                if(!window.AMOCRM) return {}
                if(key){
                    const keys = key.split('.')
                    let envItem = window.AMOCRM

                    try{
                        keys.forEach(k => {
                            if(envItem[k]) envItem = envItem[k]
                            else throw 'Element not found'
                        })
                    }
                    catch (e){
                        return undefined
                    }

                    return envItem
                }

                return window.AMOCRM
            }


        }
    }
})