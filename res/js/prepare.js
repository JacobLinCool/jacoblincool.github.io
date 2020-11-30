(function(){
    window.preparations = {};
    preparations.bg_html = fetch(`/res/html/bg.html`).then(r => r.text());
})();
