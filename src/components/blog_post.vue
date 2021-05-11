<template>
    <div class="blog_post">
        <div id="header">
            <span id="header-title"> {{ article ? article.title : "" }} </span>
        </div>
        <div id="main_content">
            <div id="title">
                <h1>{{ article ? article.title : "" }}</h1>
            </div>
            <div id="body">
                <div id="content" v-html="article ? article.rendered_content : ''"></div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "blog_post",
    data() {
        return {
            title: "Jacob's Blog",
            article: null,
            post_id: this.$route.params.post_id,
        };
    },
    methods: {
        async get_article() {
            this.article = await fetch(
                "https://api.jacob.workers.dev/blog/post/" + this.post_id
            ).then((r) => r.json());
            return this.article;
        },
        build_article(article) {
            document.title = `${article.title} | ${this.title}`;
        },
    },
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
        this.get_article().then(this.build_article);
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.blog_post {
    width: 100%;
    height: 100%;
}

#header {
    z-index: 95;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 48px;
    margin: 0;
    background: #1f3648;
    opacity: 0;
}

#header-title {
    margin: 4px 0 0 56px;
    font-size: 1.8rem;
    overflow: auto;
}

#main_content {
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    width: 100%;
}

#title {
    width: 100%;
    max-width: max(1200px, 80vh);
    padding: 10px;
    margin: 10px 0;
    background-color: #243f52;
}

#title > h1 {
    font-size: 1.8rem;
    text-align: center;
}

#body {
    width: 100%;
    max-width: max(1200px, 80vh);
    padding: 10px;
    margin: 10px 0;
    background-color: #243f52;
}
</style>
