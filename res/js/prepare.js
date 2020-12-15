(function(){
    window.preparations = {};
    preparations.bg_html = fetch(`/res/html/bg.html`).then(r => r.text());

    window.Event_BG_Ready = new Event("BG_Ready");
})();
