<template>
    <div class="project"></div>
</template>

<script>
export default {
    name: "project",
    data() {
        return {
            title: "Project",
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
.project {
    width: 100%;
    height: 100%;
}
</style>
