<template>
    <div class="blog">
        <div id="header">
            <div id="big_title">
                <span>Jacob's </span>
                <h1>Blog</h1>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "blog",
    data() {
        return {
            title: "Jacob's Blog",
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
.blog {
    width: 100%;
    height: 100%;
}

#header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 30%;
    margin: 48px 16px;
}

#header > #big_title {
    margin: 0 40px;
}
#header > #big_title > span {
    font-size: 32px;
    font-weight: bold;
}
#header > #big_title > h1 {
    font-size: min(100px, 20vmin);
    font-weight: bolder;
    margin: -10px 0 0 0;
}
</style>
