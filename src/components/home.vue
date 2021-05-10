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
    methods: {
        split_main_text() {
            let main_text = document.querySelector("#main-text");
            let text = main_text.innerText;
            main_text.innerHTML = "";
            Array.from(text).forEach((w) => {
                let span = document.createElement("span");
                span.innerHTML = w;
                main_text.appendChild(span);
            });
        },
        background_animation() {
            let tl = gsap.timeline();
            tl.from("#main-text > span", {
                top: (index) =>
                    Math.pow(-1, index) * gsap.utils.random(100, 150),
                left: (index, target, targets) =>
                    (index / (targets.length - 1) - 0.5) *
                    gsap.utils.random(150, 250),
                opacity: 0,
                duration: 0.5,
                stagger: 0.1,
            });
            for (let i = 1; i <= 3; i++) {
                tl.fromTo(
                    ".wave" + i,
                    { xPercent: 0 },
                    {
                        xPercent: -50,
                        ease: "none",
                        duration: () => gsap.utils.random(20, 36),
                        repeat: -1,
                    },
                    i > 1 ? "<" : null
                );
            }

            tl.from(
                ".wave",
                {
                    scaleY: 0,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.2,
                },
                "<"
            ).from("#bottom-white-block", { opacity: 0, duration: 1 }, "<");

            for (let i = 1; i <= 3; i++) {
                tl.to(
                    ".wave" + i,
                    {
                        scaleY: () => gsap.utils.random(0.75, 1.1),
                        ease: "none",
                        yoyo: true,
                        duration: () => gsap.utils.random(20, 36),
                        repeat: -1,
                    },
                    i > 1 ? "<" : null
                );
            }
        },
    },
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
        this.split_main_text();
        this.background_animation();
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

#main-text > span {
    display: inline-block;
    position: absolute;
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
    /* animation: wave_animate 22s linear infinite; */
}
.wave2 {
    background-size: 50% 80px;
    /* animation: wave_animate 24s linear infinite; */
}
.wave3 {
    background-size: 50% 60px;
    /* animation: wave_animate 36s linear infinite; */
}
#bottom-white-block {
    z-index: 9;
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 20%;
    background-color: #b0b6b9;
    transform: scaleY(1.005);
}

@keyframes wave_animate {
    0% {
        transform: translateX(0) scaleY(1);
    }
    50% {
        transform: translateX(-25%) scaleY(0.75);
    }
    100% {
        transform: translateX(-50%) scaleY(1);
    }
}
</style>
