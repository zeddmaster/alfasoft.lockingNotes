define(function(){

    let instance = null
    const debug = true

    return function(widget){
        instance = widget;


        return {

            getAccountData(){
                return window.AMOCRM.constant('account')
            },

            getUserData(){
                return window.AMOCRM.constant('user')
            },


            // получить права пользователя
            getUserPermissions(user_id){
                const subdomain = this.getAccountData()?.subdomain
                user_id = user_id.toString()


                return new Promise(r => {
                    this.httpRequest('https://amo.alfa-software.ru/api/alfa-locker/settings/get', { subdomain, user_id })
                        .then(response => {
                            r(response.permissions || {})
                        })
                        .catch(() => {
                            r({})
                        })
                })
            },


            // сохранить права пользователя
            saveUserPermissions(user_id, permissions){

                const subdomain = this.getAccountData()?.subdomain


                return new Promise(r => {
                    this.httpRequest('https://amo.alfa-software.ru/api/alfa-locker/settings/save', {
                        user_id, subdomain,
                        permissions: JSON.stringify(permissions)
                    })
                        .then(response => {
                            console.log(response);
                            r()
                        })
                        .catch(() => {
                            r()
                        })
                })
            },


            formDataToJSON(formData){
                let object = {}
                formData.forEach((item, key) => {

                    // for inner objects
                    let matches = key.match(/\[[^\[\]]+\]/)
                    if(matches){
                        let innerKey = matches.pop().replaceAll(/[\[\]]/g, '')
                        key = key.replace(/\[[^\[\]]+\]/, '')

                        if(!Reflect.has(object, key) || typeof object[key] !== 'object')
                            object[key] = {}

                        // ---
                        if(!Reflect.has(object[key], innerKey))
                            return object[key][innerKey] = item

                        if(!Array.isArray(object[key][innerKey]))
                            object[key][innerKey] = [object[key][innerKey]]

                        object[key][innerKey].push(item)
                    }
                    else{
                        if(!Reflect.has(object, key))
                            return object[key] = item

                        if(!Array.isArray(object[key]))
                            object[key] = [object[key]]

                        object[key].push(item)
                    }
                })

                return object
            },


            getAccountSettings(){
                let $fields = $('#widget_settings__fields_wrapper input[name]'),
                    settings = {};

                if(!$fields || !$fields.length)
                    return settings;

                $fields.each(function(){
                    let Name = $(this).attr('name');

                    if($(this).is('[type=checkbox]') && !$(this).prop('checked'))
                        return;

                    if(!Name) return;
                    settings[Name] = $(this).val();
                });

                return settings;
            },


            setupAccount(configs){

                this.httpRequest('/private/api/v2/json/accounts/current').then(response => {


                    const Account = AMOCRM.constant('account');
                    const User = AMOCRM.constant('user');

                    let settings = configs?.fields || {},
                        widgetParams = instance.params,
                        account = response.response.account,
                        users = account.users,

                        registerData = {
                            subdomain: Account.subdomain,
                            client_id: account.id,
                            client_name: account.name,
                            first_name: User.name,
                            login: User.login,
                            user_id: User.id,
                            timezone: Account.timezone,
                            status: widgetParams.status,
                            active: widgetParams.active,
                            widget_active: widgetParams.widget_active,
                            widget_code: widgetParams.widget_code,
                            tariff_name: Account.tariffName,
                            users_count: users.length,
                            paid_till_date: Account.paid_till,
                            paid_from: Account.paid_from,
                            users: []
                        };


                    if(users.length){
                        users.forEach(user => {
                            registerData.users.push({
                                user_id: user.id,
                                name: `${user.name} ${user.last_name}`,
                                email: user.login,
                                phone: user.phone,
                                is_admin: user.is_admin === "Y"
                            })
                        });
                    }
                    registerData.users = JSON.stringify(registerData.users);
                    registerData = Object.assign(registerData, settings);

                    this.httpRequest('https://amo.alfa-software.ru/api/alfa-locker/setup', registerData);
                });

            },


            httpRequest(url, data, options){
                // todo: request delay

                let self = this;

                data = data || {};
                options = options || {};
                options.JsonParse = options.JsonParse || true;

                return new Promise((resolve, reject) => {

                    let xhr = new XMLHttpRequest(),
                        formData = new FormData();

                    for (let key in data)
                        formData.append(key, data[key]);

                    xhr.onload = function(){

                        let responseData = this.responseText;

                        if (this.status < 400){

                            if(options.JsonParse){
                                try{
                                    let JsonResponse = JSON.parse(responseData);

                                    if(!options.checkSuccess || JsonResponse.success){
                                        self.log({
                                            url, data, options,
                                            response: JsonResponse
                                        });
                                        resolve(JsonResponse);
                                        return;
                                    }
                                    else{
                                        if(JsonResponse.msg)
                                            self.errorMessage(JsonResponse.msg);

                                        reject({msg: 'request unsuccessful', url, data, options, responseData, JsonResponse, xhr});
                                    }
                                }
                                catch(e){
                                    reject({msg: 'Error of parse JSON', url, data, options, responseData, xhr});
                                }
                            }
                            resolve(responseData);
                        }
                        else{
                            self.errorMessage('Ошибка, проверьте соединение');
                            reject({msg: "Request failed with status" + this.statusText, url, data, options, responseData, xhr});
                        }
                    };

                    xhr.onerror = function(r){
                        reject('Network error');
                    };


                    if(data && Object.keys(data).length){
                        xhr.open(options.httpMethod || 'POST', url, true);
                        xhr.send(formData);
                    }
                    else{
                        xhr.open('GET', url, true);
                        xhr.send();
                    }
                })
            },

            errorMessage(msg){
                this.log(msg)
            },


            log(...variables){
                debug && console.debug(...variables)
            }
        }
    }
})