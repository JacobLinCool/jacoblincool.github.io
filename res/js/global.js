// Curtain
let curtain = new Curtain();
curtain.text("Jacob Lin's Website");
curtain.add(25);
window.addEventListener("load", async () => {curtain.add(25)});

function Curtain() {
    let curtain = ".first_curtain", words = ".curtain_words", words_bg = ".curtain_words_bg", bar = ".curtain_bar";
    let self = this;
    let p = 0;
    self.progress = async function(n) {
        if(typeof n != "number") n = 0;
        if(n < 0) n = 0;
        if(n <= 1) n *= 100;
        if(n > 100) n = 100;
        p = n;
        document.querySelector(bar).style.width = n + "%";
        document.querySelector(words).style.width = parseFloat(getComputedStyle(document.querySelector(words_bg)).getPropertyValue("width"))*n/100 + "px";
        if(n == 100) {
            await wait(600);
            document.querySelector(curtain).classList.add("removed");
            await wait(400);
            return true;
        }
        return false;
    };
    self.add = async function(n) {
        if(typeof n != "number") n = 0;
        p += n;
        return self.progress(p);
    };
    self.check  = function() {
        return p >= 1;
    };
    self.out = function() { self.progress(1) };
    self.text = function(s) {
        document.querySelector(words).innerHTML = s;
        document.querySelector(words_bg).innerHTML = s;
    }
}

// Background
(async function() {
    let bg_html = await preparations.bg_html;
    document.body.innerHTML += bg_html;
    window.BG = new bg;
    document.dispatchEvent(Event_BG_Ready);
    curtain.add(50);
})();

function bg(elm=document.querySelector(".background")) {
    let self = this;
    self.elm = elm;

    self.t = function(a=1, b=0, c=0, d=1, e=0, f=0) {
        self.elm.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
    };
}

// Async Wait
function wait(t=1000) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(t);
        }, t);
    });
}
