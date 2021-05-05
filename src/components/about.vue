<template>
    <div class="about"></div>
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
}
</style>
