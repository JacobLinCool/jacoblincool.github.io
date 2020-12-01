(async function() {
    await preparations.bg_html;
})()


function bg(elm=document.querySelector(".background")) {
    let self = this;
    self.elm = elm;

    self.t = function(a=1, b=0, c=0, d=1, e=0, f=0) {
        self.elm.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
    };
}
