<template>
    <div class="about">
        <div class="container">
            <div id="img-wrapper">
                <div class="img-holder">
                    <img id="avatar" src="/static/images/jacob.jpg" />
                </div>
            </div>
            <div id="info">
                <span id="name">Jacob Lin</span>
            </div>
            <div id="contact">
                <a
                    id="email"
                    class="contact-item"
                    target="_blank"
                    href="mailto:jacoblincool@gmail.com"
                    >Email</a
                >
                <a
                    id="github"
                    class="contact-item"
                    target="_blank"
                    href="https://github.com/JacobLinCool"
                    >Github</a
                >
                <a
                    id="facebook"
                    class="contact-item"
                    target="_blank"
                    href="https://fb.me/jacoblincool"
                    >Facebook</a
                >
                <a
                    id="instagram"
                    class="contact-item"
                    target="_blank"
                    href="https://www.instagram.com/jacoblincool/"
                    >Instagram</a
                >
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "about",
    data() {
        return {
            title: "About",
        };
    },
    methods: {
        split_text() {
            let name = document.querySelector("#name");
            let name_text = name.innerText;
            name.innerHTML = "";
            Array.from(name_text).forEach((w) => {
                let span = document.createElement("span");
                span.innerHTML = w;
                name.appendChild(span);
            });
            let list = ["#email", "#github", "#facebook", "#instagram"];
            let icon = [
                "fas fa-envelope",
                "fab fa-github",
                "fab fa-facebook",
                "fab fa-instagram",
            ];
            list.forEach((id, index) => {
                let elm = document.querySelector(id);
                let text = elm.innerText;
                elm.innerHTML = `<i class="contact-icon" style="position: absolute; left: calc(50% - 16px); transform: translateX(-50%); opacity: 0;"><i class="${icon[index]}"></i></i> `;
                Array.from(text).forEach((w) => {
                    let span = document.createElement("span");
                    span.innerHTML = w;
                    elm.appendChild(span);
                });
            });
        },
        main_animation() {
            let tl = gsap.timeline();
            tl.from(".img-holder", {
                duration: 1.5,
                rotateY: "2970deg",
                ease: "circ",
            });
            tl.from("#name > span", {
                duration: 1,
                top: -40,
                left: -40,
                opacity: 0,
                stagger: 0.1,
                ease: "bounce",
            });
            let list = ["#email", "#github", "#facebook", "#instagram"];
            list.forEach((id) => {
                tl.to(id + " > i", {
                    duration: 0.2,
                    opacity: 1,
                });
                tl.to(id + " > i", {
                    duration: 0.25,
                    left: -20,
                });
                tl.from(id + " > span", {
                    duration: 0.4,
                    opacity: 0,
                    stagger: 0.1,
                });
            });
        },
    },
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
        this.split_text();
        this.main_animation();
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.about {
    width: 100%;
    height: 100%;
    letter-spacing: 1px;
}

.container {
    width: 100%;
    height: 100%;
    margin-top: 60px;
}

#img-wrapper {
    width: 100%;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.img-holder {
    border-radius: 50%;
    border: 8px #24435a solid;
    transform: translateZ(200px);
}

#avatar {
    width: 150px;
    height: 150px;
    border-radius: 50%;
}

#info,
#contact {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 8px 0;
    font-size: 24px;
    font-weight: bold;
}

#contact > a {
    margin: 4px 0;
}
#contact > a:hover {
    text-decoration: none;
}

.contact-item {
    left: 16px;
}
</style>
