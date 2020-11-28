// Curtain
let curtain = new Curtain();
function Curtain() {
    let curtain = ".first_curtain", words = ".curtain_words", bar = ".curtain_bar";
    let self = this;
    self.progress = function(n) {
        if(typeof n != "number") n = 0;
        if(n < 0) n = 0;
        if(n <= 1) n *= 100;
        if(n > 100) n = 100;
        document.querySelector(bar).style.width = n + "%";
        if(n == 100) {
            document.querySelector(curtain).style.animation = "curtain_out 1s";
        }
    };
    self.out = function() { self.progress(1) };
}
