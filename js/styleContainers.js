define(function(){
    return {
        containerStack: {},

        getContainer(id){
            return this.containerStack[id] || undefined
        },

        setContainer(id, content, wrapperSelector){
            wrapperSelector = wrapperSelector || '#page_holder'
            if(!this.containerStack[id])
                this.containerStack[id] = {
                    element: document.createElement('style'),
                    wrapperSelector
                }

            const container = this.containerStack[id]
            container.element.setAttribute('class', 'alfasoftwareLockerStyle-' + id)
            container.element.textContent = content

            return this
        },

        removeContainer(id){
            if(this.containerStack[id])
                this.containerStack[id].element.remove()

            return this
        },

        syncDOM(id, selector){
            const container = this.getContainer(id)
            if(!container) return false

            selector = selector || container.wrapperSelector
            if(!selector) return false

            if(document.querySelector(`${selector} style.alfasoftwareLockerStyle${id}`))
                return true

            const wrapper = document.querySelector(selector)
            if(!wrapper) return false

            return wrapper.appendChild(container.element)
        }
    }
})