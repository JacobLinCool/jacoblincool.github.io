<template>
    <div class="blog">
        <div id="header">
            <div id="big_title">
                <span>Jacob's </span>
                <h1>Blog</h1>
            </div>
        </div>
        <div id="main_content">
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
</template>

<script>
export default {
    name: "blog",
    data() {
        return {
            title: "Jacob's Blog",
            articles: [],
        };
    },
    methods: {
        title_split() {
            let title_1 = document.querySelector("#big_title > span");
            let title_2 = document.querySelector("#big_title > h1");
            let text_1 = title_1.innerText;
            let text_2 = title_2.innerText;
            title_1.innerHTML = title_2.innerHTML = "";
            Array.from(text_1).forEach((w) => {
                let span = document.createElement("span");
                span.innerHTML = w;
                title_1.appendChild(span);
            });
            Array.from(text_2).forEach((w) => {
                let span = document.createElement("span");
                span.innerHTML = w;
                title_2.appendChild(span);
            });
        },
        async main_animation() {
            let tl = gsap.timeline();
            tl.from("#big_title > span > span", {
                top: -30,
                left: (index, target, targets) =>
                    (index / (targets.length - 1) - 0.5) * 60,
                opacity: 0,
                duration: 0.5,
                stagger: 0.1,
            });
            tl.from("#big_title > h1 > span", {
                top: 60,
                left: (index, target, targets) =>
                    (index / (targets.length - 1) - 0.5) * 120,
                opacity: 0,
                duration: 0.5,
                stagger: 0.1,
            });
            return true;
        },
        async load_article() {
            let articles = fetch(
                "https://api.jacob.workers.dev/blog/list"
            ).then((r) => r.json());
            await Promise.all([articles, wait(2000)]);
            this.articles = (await articles).sort((a, b) => b.time - a.time);
            return articles;
        },
        async show_article(articles) {
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
        this.title_split();
        this.main_animation();
        this.load_article().then(this.show_article);
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

#main_content {
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
    width: 100%;
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
