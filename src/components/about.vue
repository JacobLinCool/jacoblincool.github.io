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
                    id="github"
                    target="_blank"
                    href="https://github.com/JacobLinCool"
                    ><i class="fab fa-github"></i> Github</a
                >
                <a
                    id="facebook"
                    target="_blank"
                    href="https://fb.me/jacoblincool"
                    ><i class="fab fa-facebook"></i> Facebook</a
                >
                <a
                    id="instagram"
                    target="_blank"
                    href="https://www.instagram.com/jacoblincool/"
                    ><i class="fab fa-instagram"></i> Instagram</a
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
    methods: {},
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
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
}

#avatar {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    filter: grayscale(0.75);
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
</style>
