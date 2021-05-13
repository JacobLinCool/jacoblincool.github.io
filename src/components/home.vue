<template>
    <div class="home" @click="page_click($event)">
        <div class="full-screen">
            <div id="main-text">Jacob Lin</div>
            <div id="full-screen-background">
                <div
                    v-for="id of [1, 2, 3]"
                    :key="id"
                    :class="'line line' + id"
                >
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
                <div
                    v-for="i of [0, 1, 2, 3, 4, 5]"
                    :key="'star' + i"
                    :id="'star' + i"
                    class="star"
                ></div>
                <div id="meteor"></div>
            </div>
        </div>
        <div id="pointer_power">
            <div
                v-for="i of [0, 1, 2, 3, 4, 5, 6, 7, 8]"
                :key="'power' + i"
                :id="'power' + i"
                class="power"
            ></div>
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

            let star = gsap.timeline();
            for (let i = 0; i <= 5; i++)
                star.fromTo(
                    "#star" + i,
                    {
                        scale: 0,
                        opacity: 0,
                        left: () => gsap.utils.random(0, 100) + "%",
                        top: () => gsap.utils.random(0, 20) + "%",
                    },
                    {
                        scale: () => gsap.utils.random(0.8, 1),
                        opacity: () => gsap.utils.random(0.8, 1),
                        duration: () => gsap.utils.random(2, 8),
                        repeat: -1,
                        yoyo: true,
                        repeatRefresh: true,
                    },
                    "<"
                );

            let meteor = gsap.timeline({
                repeat: -1,
                repeatRefresh: true,
                repeatDelay: 15,
                delay: 15,
            });
            meteor.fromTo(
                "#meteor",
                {
                    left: () => gsap.utils.random(30, 90) + "%",
                    top: () => gsap.utils.random(-10, 10) + "%",
                    x: 0,
                    y: 0,
                },
                {
                    x: -300,
                    y: 400,
                    duration: 1.5,
                    ease: "slow(0.1, 0.4, false)",
                }
            );
            meteor.fromTo(
                "#meteor",
                {
                    rotation: 0,
                },
                {
                    rotation: 2160,
                    duration: 1.5,
                    ease: "none",
                },
                "<"
            );
            meteor.fromTo(
                "#meteor",
                {
                    scale: 0,
                    opacity: 0,
                },
                {
                    scale: () => gsap.utils.random(0.8, 1),
                    opacity: () => gsap.utils.random(0.8, 1),
                    duration: 0.75,
                    ease: "slow(0.1, 0.4, false)",
                    repeat: 1,
                    yoyo: true,
                },
                "<"
            );
        },
        page_click(event) {
            console.log(event);
            const x = event.pageX,
                y = event.pageY;
            for (let i = 0; i <= 8; i++) {
                const theta = gsap.utils.random(0, 2 * Math.PI);
                const color = `rgb(95,${gsap.utils.random(95, 190, 1)},255)`;
                gsap.fromTo(
                    "#power" + i,
                    {
                        x: 0,
                        y: 0,
                        top: y + "px",
                        left: x + "px",
                        background: color,
                        scale: gsap.utils.random(0.5, 1),
                    },
                    {
                        x: Math.cos(theta) * gsap.utils.random(20, 40),
                        y: Math.sin(theta) * gsap.utils.random(20, 40),
                        background: color,
                        duration: 0.8,
                        scale: 0,
                    }
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
#full-screen-background {
    z-index: 1;
    width: 100%;
    height: 100%;
    background-color: #152531;
}
#main-text {
    z-index: 50;
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
    background: transparent;
    overflow: hidden;
}
.line1 {
    z-index: 9;
    opacity: 0.3;
}
.line2 {
    z-index: 8;
    opacity: 0.4;
}
.line3 {
    z-index: 7;
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
}
.wave2 {
    background-size: 50% 80px;
}
.wave3 {
    background-size: 50% 60px;
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

.star {
    z-index: 3;
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #cdd9e2;
}

#meteor {
    z-index: 5;
    position: absolute;
    width: 10px;
    height: 10px;
    background: #ffc14f;
    border-radius: 0%;
}

#pointer_power {
    z-index: 100000;
    transform: translateZ(100000px);
    position: absolute;
    left: 0;
    top: 0;
}
.power {
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: rgb(95, 164, 255);
    transform: translate3d(-50%, -50%, 0) scale(0);
}
</style>
