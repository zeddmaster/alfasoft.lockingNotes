define([`${localStorage['AlfaSoftDebug'] || '.'}`+ '/js/app.js'], function(createAppInstance){
    return function(){

        const App = new createAppInstance(this);
        this.callbacks = App.callbacks;

        return this;
    }
});