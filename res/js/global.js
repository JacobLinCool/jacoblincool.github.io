// Curtain
let curtain = new Curtain();
curtain.text("Jacob Lin's Website");
document.addEventListener("DOMContentLoaded", async () => {curtain.progress(25)});
window.addEventListener("load", async () => {curtain.out()});
function Curtain() {
    let curtain = ".first_curtain", words = ".curtain_words", words_bg = ".curtain_words_bg", bar = ".curtain_bar";
    let self = this;
    self.progress = async function(n) {
        if(typeof n != "number") n = 0;
        if(n < 0) n = 0;
        if(n <= 1) n *= 100;
        if(n > 100) n = 100;
        document.querySelector(bar).style.width = n + "%";
        document.querySelector(words).style.width = parseFloat(getComputedStyle(document.querySelector(words_bg)).getPropertyValue("width"))*n/100 + "px";
        if(n == 100) {
            await wait(600);
            document.querySelector(curtain).classList.add("removed");
        }
    };
    self.out = function() { self.progress(1) };
    self.text = function(s) {
        document.querySelector(words).innerHTML = s;
        document.querySelector(words_bg).innerHTML = s;
    }
}

// Async Wait
function wait(t=1000) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(t);
        }, t);
    });
}
