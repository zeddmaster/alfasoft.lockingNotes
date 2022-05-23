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
                            customFields.unshift({ id: 'PRICE', name: 'Бюджет', base_field: true })
                        customFields.unshift({ id: 'MAIN_USER', name: 'Ответственный', base_field: true })

                        if(options.twig)
                            customFields = this.customFieldsForTwig(entity, customFields)

                        resolve(customFields)
                    }).catch(() => resolve([]))
                })
            },

            // customFields to twig format
            customFieldsForTwig(entity, custom_fields){
                custom_fields.forEach((field, index) => {
                    let fieldName = field.base_field ? 'denyField' : 'denyCustomField'
                    custom_fields[index] = {
                        id: field.id,
                        option: field.name,
                        name: `${fieldName}[${entity}]`
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
             * @param twigFields
             * @param permissions
             */
            setDenyCustomFields(twigFields, permissions){

                const fieldStorages = ['denyCustomField', 'denyField']

                fieldStorages.forEach(storeName => {
                    const fields = permissions[storeName]

                    baseHelper.log({customFields: twigFields, permissions})
                    if(!fields) return baseHelper.log(`permissions for custom fields not found'`, {fields, storeName})

                    for(let entity in twigFields){
                        if(!fields[entity]) continue
                        const entityCustomFields = twigFields[entity]
                        entityCustomFields.forEach(i => {
                            if(!i.processed) {
                                i.is_checked = !!~fields[entity].indexOf(i.id.toString())
                                i.processed = true
                            }
                        })
                    }
                })
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
            env(key, def){
                if(!window.AMOCRM) return def || {}
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
                        return def
                    }

                    return envItem
                }

                return window.AMOCRM
            }


        }
    }
})