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
                    <div class="article-head">
                        <h1 class="article-title">{{ article.title }}</h1>
                    </div>
                    <div class="article-body">
                        {{ article.summary }}
                    </div>
                    <div class="article-foot">
                        <div class="article-tag">
                            {{ article.tag.join(", ") }}
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
            this.articles = await articles;
            return articles;
        },
        async show_article(articles) {
            let tl = gsap.timeline();
            tl.to(".article", {
                duration: 0.3,
                stagger: 0.2,
                scaleY: 1,
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
    transform: scaleY(0);
    transform-origin: top;
}

.article-head,
.article-body,
.article-foot {
    width: 100%;
    padding: 0 12px;
}
.article-head {
    min-height: 60px;
    border-bottom: 1px dashed #9da6ad;
}
.article-body {
    min-height: 160px;
    border-bottom: 1px dashed #9da6ad;
}
.article-foot {
    min-height: 40px;
}
.article-title {
    padding: 6px 0;
    margin: 0;
}
</style>
