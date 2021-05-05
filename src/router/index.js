import Vue from "vue";
import Router from "vue-router";
const home = () => import("@/components/home");
const blog = () => import("@/components/blog");
const project = () => import("@/components/project");
const about = () => import("@/components/about");

Vue.use(Router);

let router = new Router({
    mode: "history",
    routes: [
        {
            path: "/",
            name: "home",
            component: home,
        },
        {
            path: "/blog",
            name: "blog",
            component: blog,
        },
        {
            path: "/project",
            name: "project",
            component: project,
        },
        {
            path: "/about",
            name: "about",
            component: about,
        },
        {
            path: "/*",
            redirect: "/",
        },
    ],
});

router.afterEach((to, from) => {
    console.log(`%c[Router] Location changed: from ${from.name} to ${to.name}`, `color: #fbe7c6;`);
    window.params = {};
    try {
        for (let [k, v] of window.location.href
            .split("?")[1]
            .split("&")
            .map((kv) => kv.split("=").map(decodeURIComponent)))
            window.params[k] = v;
    } catch (e) {}
});

export default router;
