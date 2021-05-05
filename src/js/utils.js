function wait(t = 1000) {
    return new Promise((r) => {
        setTimeout(() => {
            r();
        }, t);
    });
}

function get_orientation() {
    var orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";
    return orientation;
}

export default { wait, get_orientation };
