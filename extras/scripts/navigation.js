/* ============================================================
   JellymountPlus — Top Navigation behaviour
   Injects the JellymountPlus logo, relabels Favorites as
   "My List", adds username+caret next to the avatar, and drives
   the transparent → solid nav transition on scroll.
   ============================================================ */
(function () {
    'use strict';

    var JMP = window.JellymountPlus;
    if (!JMP) return;

    var logoObserver = null;
    var scrollBound = false;

    /* ---------------- Logo ---------------- */

    function logoMarkup() {
        if (JMP.config.logoUrl) {
            return '<img src="' + JMP.esc(JMP.config.logoUrl) + '" alt="JellymountPlus">';
        }
        var text = JMP.config.logoText || 'JellymountPlus';
        /* Split trailing "Plus" so it renders in brand blue. */
        var idx = text.lastIndexOf('Plus');
        if (idx > 0) {
            return '<span class="jmp-logo-text">' + JMP.esc(text.slice(0, idx)) + '</span>' +
                   '<span class="jmp-logo-text jmp-logo-plus">' + JMP.esc(text.slice(idx)) + '</span>';
        }
        return '<span class="jmp-logo-text">' + JMP.esc(text) + '</span>';
    }

    function buildLogo() {
        var a = document.createElement('a');
        a.className = 'jmp-logo';
        a.href = '#/';
        a.setAttribute('aria-label', 'JellymountPlus home');
        a.innerHTML = logoMarkup();
        return a;
    }

    /* ---------------- Toolbar wiring ---------------- */

    function wireModernToolbar(toolbar) {
        if (toolbar.dataset.jmpNav) return;
        toolbar.dataset.jmpNav = '1';

        /* Logo before the first button group */
        var firstGroup = toolbar.querySelector('.MuiStack-root') || toolbar.firstElementChild;
        if (firstGroup && !toolbar.querySelector('.jmp-logo')) {
            toolbar.insertBefore(buildLogo(), firstGroup);
        }
        document.documentElement.classList.add('jmp-logo-active');

        /* Relabel the "Favorites" nav entry as "My List". */
        var favBtn = toolbar.querySelector('a[href*="tab=1"], .MuiButton-root[href*="tab=1"]');
        if (favBtn && !favBtn.dataset.jmpMylist) {
            favBtn.dataset.jmpMylist = '1';
            /* Replace the trailing text node, keep the heart icon. */
            var nodes = Array.prototype.slice.call(favBtn.childNodes);
            var label = nodes.filter(function (n) { return n.nodeType === 3 && n.textContent.trim(); })[0];
            if (label) label.textContent = 'My List';
            else if (favBtn.lastChild && favBtn.lastChild.nodeType === 3) favBtn.lastChild.textContent = 'My List';
        }

        /* Username + caret next to the avatar IconButton. */
        var buttons = toolbar.querySelectorAll('.MuiIconButton-root');
        var avatarBtn = buttons.length ? buttons[buttons.length - 1] : null;
        if (avatarBtn && !avatarBtn.parentNode.querySelector('.jmp-user')) {
            JMP.whenReady(function () {
                var c = JMP.api();
                if (!c) return;
                Promise.resolve(c.getCurrentUser ? c.getCurrentUser() : null).then(function (user) {
                    if (!user || !user.Name || !avatarBtn.isConnected) return;
                    var wrap = JMP.el('span', 'jmp-user');
                    wrap.innerHTML = '<span class="jmp-user-name">' + JMP.esc(user.Name) + '</span>' +
                                     '<span class="material-icons jmp-user-caret" aria-hidden="true">expand_more</span>';
                    avatarBtn.parentNode.insertBefore(wrap, avatarBtn);
                    /* Clicking the label opens the same menu as the avatar. */
                    wrap.style.cursor = 'pointer';
                    wrap.addEventListener('click', function () { avatarBtn.click(); });
                }).catch(function () { /* noop */ });
            });
        }
    }

    function wireLegacyHeader(header) {
        if (header.dataset.jmpNav) return;
        header.dataset.jmpNav = '1';
        var left = header.querySelector('.headerLeft');
        if (left && !left.querySelector('.jmp-logo')) {
            left.appendChild(buildLogo());
        }
        document.documentElement.classList.add('jmp-logo-active');
    }

    function scan() {
        var toolbar = document.querySelector('header.MuiAppBar-root .MuiToolbar-root');
        if (toolbar) wireModernToolbar(toolbar);
        var skin = document.querySelector('.skinHeader');
        if (skin) wireLegacyHeader(skin);
    }

    function startObserver() {
        if (logoObserver) return;
        scan();
        logoObserver = new MutationObserver(function () {
            scan();
        });
        logoObserver.observe(document.body, { childList: true, subtree: true });
        /* The observer is cheap but permanent — nav persists across views. */
    }

    /* ---------------- Scroll → solid nav ---------------- */

    /* Jellyfin scrolls an inner container (window.scrollY stays 0), while
       emby-scroller fires horizontal events — track the vertically
       scrollable element we actually see events from. */
    var scroller = null;

    function onScroll(e) {
        var doc = document.documentElement;
        var y = window.scrollY || doc.scrollTop || 0;
        var t = e && e.target;
        if (t && t !== document && t !== window && typeof t.scrollTop === 'number' &&
                t.scrollHeight - t.clientHeight > 8) {
            scroller = t;
        }
        if (scroller && !scroller.isConnected) scroller = null;
        if (scroller) y = Math.max(y, scroller.scrollTop);
        if (JMP.config.debug) {
            console.log('[JellymountPlus] nav scroll y=' + y +
                ' target=' + (e && e.target && (e.target.id || e.target.className || e.target.nodeName)));
        }
        if (y > 36) doc.classList.add('jmp-nav-solid');
        else doc.classList.remove('jmp-nav-solid');
    }

    function bindScroll() {
        if (scrollBound) return;
        scrollBound = true;
        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        onScroll();
    }

    /* ---------------- Module ---------------- */

    JMP.register('navigation', {
        onView: function () {
            startObserver();
            bindScroll();
        }
    });

    /* Nav exists before the first viewshow in some shells. */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { startObserver(); bindScroll(); });
    } else {
        startObserver();
        bindScroll();
    }
})();
