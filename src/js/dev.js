/*********************
 * Edura 人很好，她常常會給你一些在手機上除錯的幫助
 *********************/
function Edura() {
    let self = this;
    self.src = "https://cdn.jsdelivr.net/npm/eruda";

    self.hello = () => {
        if (window.location.pathname.includes("dev")) {
            console.log(`%c[Edura] `, `color:#a0e7e5;`, ["Hello! Hello! Hello!"]);
            document.write("<scr" + 'ipt src="' + self.src + '"></scr' + "ipt>");
            document.write("<scr" + "ipt>eruda.init();</scr" + "ipt>");
        } else {
            console.log(`%c[Edura] `, `color:#a0e7e5;`, ["It seems that you don't need my help now."]);
        }
    };
}

export { Edura };
