/* ============================================================
   JellymountPlus — Loader
   Single <script> bootstrap. Detects its own base URL, then
   injects the stylesheet bundle and every module in order.

   Install (webroot method):
     1. Copy the JellymountPlus folder into your jellyfin-web root
        (e.g. C:\Program Files\Jellyfin\Server\jellyfin-web\)
     2. Add to index.html before </body>:
        <script defer src="jellymountplus/jellymountplus-loader.js"></script>

   With the File Transformation / JS-injector plugins, register
   this loader once and it pulls in everything else.
   ============================================================ */
(function () {
    'use strict';

    if (window.JellymountPlus && window.JellymountPlus.__loaded) return;

    /* Derive base path from this script's own URL. */
    var src = (document.currentScript && document.currentScript.src) || '';
    var base = src ? src.slice(0, src.lastIndexOf('/') + 1) : 'jellymountplus/';

    /* ---- Styles ---- */
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = base + '../styles/jellymountplus.css';
    css.id = 'jmp-styles';
    document.head.appendChild(css);

    /* ---- Scripts (order matters: core first) ---- */
    var files = [
        'scripts/jellymountplus.js',
        'scripts/navigation.js',
        'scripts/hero.js',
        'scripts/rails.js',
        'scripts/hover-preview.js',
        'scripts/details.js'
    ];

    files.forEach(function (f) {
        var s = document.createElement('script');
        s.src = base + f;
        s.defer = true;
        document.head.appendChild(s);
    });
})();
