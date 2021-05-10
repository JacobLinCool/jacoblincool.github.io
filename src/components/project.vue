<template>
    <div class="project">
        <div class="header">
            <span
                class="go-left"
                @click="
                    tab_index = (tabs.length + tab_index - 1) % tabs.length;
                    tab = tabs[tab_index];
                "
                ><i class="fas fa-chevron-left"></i
            ></span>
            <transition name="fade" mode="out-in">
                <h1 class="tab-type" v-if="tab == 'progress'" key="progress">
                    In Progress
                </h1>
                <h1 class="tab-type" v-if="tab == 'maintain'" key="maintain">
                    Maintaining
                </h1>
                <h1 class="tab-type" v-if="tab == 'complete'" key="complete">
                    Completed
                </h1>
                <h1 class="tab-type" v-if="tab == 'abort'" key="abort">
                    Aborted
                </h1>
            </transition>
            <span
                class="go-right"
                @click="
                    tab_index = (tab_index + 1) % tabs.length;
                    tab = tabs[tab_index];
                "
            >
                <i class="fas fa-chevron-right"></i
            ></span>
        </div>
    </div>
</template>

<script>
export default {
    name: "project",
    data() {
        return {
            title: "Project",
            tabs: ["progress", "maintain", "complete", "abort"],
            tab: "progress",
            tab_index: 0,
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
    margin: 60px 0 0 0;
}

.header {
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    margin: 0 0 16px 0;
}
.header > h1 {
    font-size: 52px;
    font-weight: bolder;
}
.header > .go-left,
.header > .go-right {
    margin: 6px;
    font-size: 22px;
    font-weight: bolder;
    cursor: pointer;
}

.tab-type {
    width: 300px;
    text-align: center;
}
</style>
