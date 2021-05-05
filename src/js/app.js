import Vue from "vue";
import Vuex from "vuex";
import App from "../App";
import router from "../router";

/* setup Vue plugins */
Vue.use(Vuex);

/* set Vue config */
Vue.config.productionTip = false;

/* setup Vuex store */
const store = new Vuex.Store({
    state: {},
    getters: {},
    mutations: {},
    actions: {},
});

/* setup Vue app */
let app = new Vue({
    el: "#app",
    store: store,
    router: router,
    components: { App },
    template: "<App/>",
    watch: {},
    metaInfo: {
        title: "Jacob Lin",
    },
});

export default app;
