// Curtain
let curtain = new Curtain();
curtain.text("Jacob Lin's Website");
curtain.add(25);
window.addEventListener("Library_Loaded", function() {
    curtain.add(25 / js_librarian.libraries.length);
    console.log(js_librarian.libraries.filter(l => l.loaded == true));
});
js_librarian = new librarian;
js_librarian.add([
    {name: "sweetalert2", url: "/res/js/sweetalert2.all.min.js"},
    {name: "lodash", url: "https://cdn.jsdelivr.net/npm/lodash@4.17.20/lodash.min.js"},
    {name: "popper", url: "https://unpkg.com/@popperjs/core@2"},
    {name: "tippy", url: "https://unpkg.com/tippy.js@6"}
]);
js_librarian.load();
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

function librarian() {
    let self = this;
    self.libraries = [];
    self.event = new Event("Library_Loaded");
    self.add = function(...arg) {
        let standardized = [];
        if(arg.length == 1) {
            if(Array.isArray(arg[0])) {
                standardized = arg[0];
            }
            else {
                standardized.push(arg[0]);
            }
        }
        else if(arg.length > 1) {
            let name = null;
            for(let i = 0; i < arg.length; i++) {
                if(typeof arg[i] == "object") {
                    standardized.push(arg[i]);
                }
                else if(name) {
                    standardized.push({ name: name, url: arg[i] });
                    name = null;
                }
                else {
                    name = arg[i];
                }
            }
        }
        standardized.forEach(library => {
            if(!self.libraries.find(l => l.name == library.name)) {
                self.libraries.push({
                    name: library.name,
                    url: library.url,
                    loaded: false
                });
            }
        });
    };
    self.load = function() {
        self.libraries.forEach((library, index) => {
            if(!library.loaded) {
                let tag = document.createElement("script");
                tag.id = "librarian_" + library.name;
                tag.src = library.url;
                tag.addEventListener("load", function() {
                    self.libraries[index].loaded = true;
                    window.dispatchEvent(self.event);
                });
                document.head.appendChild(tag);
            }
        });
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
