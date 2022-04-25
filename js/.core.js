

class linerCopyColoredLeads{

    constructor(widgetObj, widgetCode){

        this.terminalDomain = 'test.linercrm.ru';

        this.widget = widgetObj || {};
        this.code = widgetCode || '';

        this.name = ''; // Widget name for notices

        this.Account = AMOCRM.constant('account');
        this.User = AMOCRM.constant('user');
    }

    initialize(){
        if(this.widget.langs.widget.name)
            this.name = this.widget.langs.widget.name;

        this.connectStyles();
    }


    registerAccount(){

        this.httpRequest('/private/api/v2/json/accounts/current').then(response => {

            let settings = this.getSettings(),
                widgetParams = this.widget.params,
                account = response.response.account,
                users = account.users,

                registerData = {
                    subdomain: this.Account.subdomain,
                    client_id: account.id,
                    client_name: account.name,
                    first_name: this.User.name,
                    login: this.User.login,
                    user_id: this.User.id,
                    timezone: this.Account.timezone,
                    status: widgetParams.status,
                    active: widgetParams.active,
                    widget_active: widgetParams.widget_active,
                    widget_code: widgetParams.widget_code,
                    tariff_name: this.Account.tariffName,
                    users_count: users.length,
                    paid_till_date: this.Account.paid_till,
                    paid_from: this.Account.paid_from,
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

            this.doRequest('setup', registerData);

        });

        return true;
    }


    renderSettings($modal){

        if(!$modal.length) return;

        /* STEP: Render phone field
        ------------------------------------------------*/
            let phoneField = $modal.find('input[name=phone]');

            if(phoneField.length){
                phoneField.closest('.widget_settings_block__item_field').find('.widget_settings_block__title_field')
                    .attr('style', 'font-weight: bold; margin: 15px 0 10px');

                phoneField.mask('+9 (999) 999-99-99');
            }


        /* STEP: Show agreement's info
        ------------------------------------------------*/
            if(this.widget.params && this.widget.params.status === 'installed'){
                this.doRequest('info')
                    .then(data => {
                        if(data.agreement_period){

                            let agreementEnd = this.formatDate(data.agreement_period, false),
                                nowTime = (new Date).getTime();

                            if(data.agreement_period >= nowTime){
                                $modal.find('.linercrm-agreement-period')
                                    .html(`Активирован до ${agreementEnd}`);
                            }
                            else
                                $modal.find('.linercrm-agreement-period').css('color', '#ff9800')
                                    .html('Лицензия просрочена');
                        }
                    })
            }

    }


    /* --- AUXILIARY FUNCTIONALITY --- */

    getSettings(){
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
    }


    doRequest(action, data, options){

        data = data || {};
        data.subdomain = this.Account.subdomain;

        options = options || {};
        options.checkSuccess = true;


        console.log('Do Request to ' + action, data);

        return this.httpRequest(`https://${this.terminalDomain}/api/${this.code}/${action}`, data, options);
    }


    httpRequest(url, data, options){

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

                            if(JsonResponse.redirect)
                                self.redirect(JsonResponse.redirect);

                            if(!options.checkSuccess || JsonResponse.success){
                                // debug
                                console.log(url, JsonResponse);
                                resolve(JsonResponse);
                                return;
                            }
                            else{
                                if(JsonResponse.msg)
                                    self.errorMessage(JsonResponse.msg);

                                // debug
                                console.log(url, JsonResponse);
                                reject(JsonResponse);
                            }
                        }
                        catch(e){
                            // debug
                            console.log(url, responseData);
                            reject(new Error('Error of parse JSON ' + responseData));
                        }
                    }

                    // debug
                    console.log(url, responseData);
                    resolve(responseData);
                }
                else{
                    self.errorMessage('Ошибка, проверьте соединение');
                    // debug
                    console.log(url, this.statusText);
                    reject(new Error("Request failed: " + this.statusText));
                }
            };

            xhr.onerror = function(){
                reject(new Error('Network error'));
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
    }


    renderTemplate(template, params, elementClass){

        elementClass = elementClass || 'linercrm-widget';
        params = params || {};

        this.getTemplate(template)
            .then((template) => {
                this.widget.render_template({
                    caption: {
                        class_name: elementClass,
                        html: ''
                    },
                    body: '',
                    render: template.render(params)
                })
            })
    }

    renderTemplateFromString(template, params){
        return this.widget.render({ data: template }, params);
    }

    /**
     * Добавить вкладку в карточке
     * @param id
     * @param name
     * @param sort
     * @param html
     */
    renderTab(id, name, sort, html) {

        // check current card
        if(!AMOCRM.data.current_card) return;

        let tabData = {
                _tab_type: 'groups',
                id: id,
                name: name,
                sort: sort
            },
            amoTabs = AMOCRM.data.current_card.tabs;

        // set last if sort not defined
        if(sort === undefined)
            sort = amoTabs._tabs.length - 1;

        // create fields
        amoTabs._tabs.splice(sort, 0, tabData);

        // write content
        let tabContent = $(`<div>${html}</div>`);

        tabContent.attr('class', 'linked-forms__group-wrapper linked-forms__group-wrapper_main js-cf-group-wrapper')
            .attr('data-id', id)
            .hide();

        tabContent.appendTo('.card-entity-form__fields');

        amoTabs.render(); // yep ^^
    };


    errorMessage(text, header, date, callback){
        header = header || this.name;
        callback = callback || false;
        date = date || Math.ceil(Date.now() / 1000);

        AMOCRM.notifications.add_error({
            header,
            text,
            date
        }, callback);
    }


    /*
     * Return promise with template object
     * template need render method
     */
    getTemplate(template) {
        template = template || '';

        return new Promise((resolve) => {
            this.widget.render({
                href: '/templates/' + template + '.twig',
                base_path: this.widget.params.path,
                load: resolve
            });
        });
    };


    redirect(uri){
        AMOCRM.router.navigate(uri, { trigger: true });
    }


    connectStyles(){

        let $head = $('head'),
            widgetPath = this.widget.params.path,
            widgetSettings = this.widget.get_settings();

        if(!$('#linercrm__colored-leads-base').length)
            $head.append('<link id="linercrm__colored-leads-base" '
                + 'rel="stylesheet" '
                + 'type="text/css" '
                + `href="${widgetPath}/css/base-styles.css?v=${widgetSettings.version}" />`);

        if(!$('#linercrm__colored-leads').length)
            $head.append('<link id="linercrm__colored-leads" '
                + 'rel="stylesheet" '
                + 'type="text/css" '
                + `href="${widgetPath}/css/widget.css?v=${widgetSettings.version}" />`);
    }


    // get form data object type
    getFormData(formId){
        let $form = $(formId),
            data = {};

        if(!$form || !$form.length)
            return data;

        let dataArray = $form.serializeArray();

        if(dataArray)
            dataArray.forEach(value => {
                if(data[value.name]){
                    if(!Array.isArray(data[value.name]))
                        data[value.name] = [data[value.name]];

                    data[value.name].push(value.value);
                }
                else
                    data[value.name] = value.value;
            });

        return data;
    }


    formatDate(date, withTime){
        if(toString.call(date) !== "[object Date]")
            date = new Date(date);
        if(toString.call(date) !== "[object Date]")
            return false;

        let formated = `${("00" + date.getDate()).slice(-2)}.${("00" + (date.getMonth() + 1)).slice(-2)}.${date.getFullYear()}`;

        if(withTime)
            formated += ` ${("00" + date.getHours()).slice(-2)}:${("00" + date.getMinutes()).slice(-2)}`;

        return formated;
    }


}