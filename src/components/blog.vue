<template>
    <div class="blog"></div>
</template>

<script>
export default {
    name: "blog",
    data() {
        return {
            title: "Blog",
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
</style>
