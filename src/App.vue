<template>
    <div id="app" class="">
        <transition name="fade" mode="out-in">
            <div
                v-show="true"
                id="main-menu-button"
                @click="menu_open = !menu_open"
            >
                <i
                    class="fas fa-bars"
                    style="font-size: 36px; color: #cdd9e2"
                ></i>
            </div>
        </transition>
        <transition name="menu" mode="out-in">
            <div id="main-menu" v-show="menu_open">
                <div class="menu-item" @click="navigate_to('/')">Home</div>
                <div class="menu-item" @click="navigate_to('/blog')">Blog</div>
                <div class="menu-item" @click="navigate_to('/project')">
                    Project
                </div>
                <div class="menu-item" @click="navigate_to('/about')">
                    About
                </div>
            </div>
        </transition>
        <transition name="fade" mode="out-in">
            <div
                v-show="menu_open"
                class="menu-barrier"
                @click="menu_open = false"
            ></div>
        </transition>
        <transition name="fade" mode="out-in">
            <router-view />
        </transition>
        <div class="background"></div>
    </div>
</template>

<script>
export default {
    name: "App",
    data() {
        return { menu_open: false };
    },
    methods: {
        navigate_to(page = "/") {
            this.$router.push(page);
            this.menu_open = false;
        },
    },
    mounted() {
        console.log(`%c[Jacob] Welcome to my website!`, `color:#a0e7e5;`);
        window.V = this;
    },
};
</script>

<style>
* {
    position: relative;
}

html,
body {
    width: 100%;
    height: 100%;
    padding: 0px;
    margin: 0px;
    overflow: auto;
}

body {
    z-index: -100;
    background-color: #152531;
}
#app {
    width: 100%;
    height: 100%;
    font-family: "Avenir", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #cdd9e2;
}
.background {
    z-index: -1;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #152531;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
    opacity: 0;
}

#main-menu-button {
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 48px;
    height: 48px;
    background: #1f3648;
    border-radius: 0 0 10px 0;
    cursor: pointer;
    transform: translateZ(10000px);
}

#main-menu {
    z-index: 9000;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 300px;
    height: 100%;
    padding: 48px 0 0 0;
    background: #1f3648;
    transition: all 0.3s;
    overflow: hidden;
    transform: translateZ(9000px);
}
#main-menu > .menu-item {
    width: 100%;
    height: 48px;
    font-size: 32px;
    color: #cdd9e2;
    padding: 6px 12px;
    margin: 6px 0;
    cursor: pointer;
    transition: all 0.3s;
}
#main-menu > .menu-item:hover {
    font-weight: bold;
    color: #cdd9e2;
    padding: 6px 20px;
    margin: 6px 0;
}

.menu-enter-active,
.menu-leave-active {
    width: 300px;
    height: 100%;
}
.menu-enter,
.menu-leave-to {
    /*opacity: 0;*/
    height: 0 !important;
    width: 0 !important;
}

.menu-barrier {
    z-index: 8000;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: #15253133;
    transform: translateZ(8000px);
}
</style>
