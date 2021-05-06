<template>
    <div class="home">
        <div class="full-screen">
            <div id="main-text">Jacob Lin</div>
            <div v-for="id of [1, 2, 3]" :key="id" :class="'line line' + id">
                <div
                    :class="'wave wave' + id"
                    :style="
                        'background-image: url(/static/images/waves/' +
                        id +
                        '.png);'
                    "
                ></div>
            </div>
            <div id="bottom-white-block"></div>
        </div>
    </div>
</template>

<script>
export default {
    name: "home",
    data() {
        return {
            title: "Jacob Lin",
        };
    },
    methods: {},
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.home {
    width: 100%;
    height: 100%;
}
.full-screen {
    width: 100%;
    height: 100%;
}
#main-text {
    z-index: 10;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: min(15vmin, 72px);
    font-weight: bold;
    white-space: nowrap;
}
.line {
    position: absolute;
    width: 100%;
    height: 100%;
    background: #152531;
    overflow: hidden;
}
.line1 {
    z-index: 6;
    opacity: 0.3;
}
.line2 {
    z-index: 5;
    opacity: 0.4;
}
.line3 {
    z-index: 4;
    opacity: 0.2;
}
.wave {
    position: absolute;
    left: 0;
    bottom: 20%;
    width: 200%;
    height: 100%;
    background-repeat: repeat no-repeat;
    background-position: 0 bottom;
    transform-origin: center bottom;
}
.wave1 {
    background-size: 50% 60px;
    animation: wave_animate 22s linear infinite;
}
.wave2 {
    background-size: 50% 80px;
    animation: wave_animate 24s linear infinite;
}
.wave3 {
    background-size: 50% 60px;
    animation: wave_animate 36s linear infinite;
}
#bottom-white-block {
    z-index: 9;
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 20%;
    background-color: #b0b6b9;
    transform: scaleY(1.05);
}

@keyframes wave_animate {
    0% {
        transform: translateX(0) translateZ(0) scaleY(1);
    }
    50% {
        transform: translateX(-25%) translateZ(0) scaleY(0.75);
    }
    100% {
        transform: translateX(-50%) translateZ(0) scaleY(1);
    }
}
</style>
