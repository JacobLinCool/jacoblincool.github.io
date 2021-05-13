<template>
    <div class="blog_tag">
        <div id="header">
            <span id="header-title">
                <i class="fas fa-tag" style="top: 2px"></i> {{ tag }}
            </span>
        </div>
        <div id="main_content">
            <div id="title">
                <h1><i class="fas fa-tag" style="top: 2px"></i> {{ tag }}</h1>
            </div>
            <div id="body">
                <div
                    v-for="(article, index) in articles"
                    :key="index"
                    class="article-wrapper"
                >
                    <div class="article">
                        <div
                            class="article-head"
                            @click="$router.push('/blog/post/' + article.time)"
                        >
                            <h1 class="article-title">{{ article.title }}</h1>
                        </div>
                        <div class="article-body">
                            {{ article.summary }}
                        </div>
                        <div class="article-foot">
                            <div class="article-tag">
                                <i class="fas fa-tag" style="top: 2px"></i>
                                <router-link
                                    :to="'/blog/tag/' + tag"
                                    class="tag"
                                    v-for="tag in article.tag"
                                    :key="tag"
                                    >{{ tag }}</router-link
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "blog_tag",
    data() {
        return {
            title: "Jacob's Blog",
            articles: [],
            tag: this.$route.params.tag,
        };
    },
    methods: {
        async get_articles() {
            this.articles = await fetch(
                "https://api.jacob.workers.dev/blog/search?tag=" + this.tag
            ).then((r) => r.json());
            return this.articles;
        },
        build_list(article) {
            document.title = `Tag: ${this.tag} | ${this.title}`;

            let tl = gsap.timeline();
            tl.to(".article", {
                duration: 0.4,
                stagger: 0.2,
                scale: 1,
                opacity: 1,
                ease: "back",
            });
        },
    },
    mounted: function () {
        document.title = this.title || this.text_title || document.title || "";
        this.get_articles().then(this.build_list);
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.blog_tag {
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

.article-wrapper {
    width: 100%;
    max-width: max(1200px, 80vh);
    margin: 30px 0;
}
.article {
    min-height: 260px;
    background-color: #243f52;
    transform: scale(0);
    opacity: 0;
    transform-origin: top;
}

.article-head,
.article-body,
.article-foot {
    width: 100%;
    padding: 0 12px;
}
.article-head {
    min-height: 50px;
    border-bottom: 1px dashed #9da6ad;
    cursor: pointer;
}
.article-body {
    min-height: 170px;
    border-bottom: 1px dashed #9da6ad;
}
.article-foot {
    min-height: 40px;
}
.article-title {
    font-size: 2rem;
    padding: 6px 0;
    margin: 0;
}
.article-tag {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
}
.tag {
    color: #cdd9e2;
    margin: 0 3px;
}
.tag:hover {
    text-decoration: none;
}
.tag::before {
    content: "";
    width: 0;
    position: absolute;
    height: 2px;
    bottom: 1px;
    background-color: #cdd9e2;
    transition: all 0.3s;
}
.tag:hover::before {
    width: 100%;
}
</style>
