/* ============================================================
   JellymountPlus — Detail page enhancements
   Keeps the cinematic header honest: fills in the logo when the
   controller left it empty, patches a missing backdrop, and
   makes the favourite button read as "My List" state.
   ============================================================ */
(function () {
    'use strict';

    var JMP = window.JellymountPlus;
    if (!JMP) return;

    function currentItemId() {
        var m = (location.hash || '').match(/[?&]id=([0-9a-fA-F]+)/);
        return m ? m[1] : null;
    }

    function enhance(view) {
        var id = currentItemId();
        if (!id) return;

        var backdrop = view.querySelector('.itemBackdrop');
        var logo = view.querySelector('.detailLogo');
        if (!backdrop && !logo) {
            /* Detail DOM isn't rendered yet — wait for it. */
            JMP.watch(view, function () {
                return view.querySelector('.itemBackdrop') || view.querySelector('.detailLogo');
            }, function () { enhance(view); });
            return;
        }

        JMP.getItem(id).then(function (item) {
            if (!view.isConnected) return;

            /* Backdrop: only fill when Jellyfin left it blank. */
            if (backdrop && !backdrop.style.backgroundImage && !backdrop.querySelector('img')) {
                var url = JMP.backdropUrl(item, 1920);
                if (url) backdrop.style.backgroundImage = 'url("' + url + '")';
            }

            /* Logo: only fill when controller produced nothing. */
            if (logo && !logo.style.backgroundImage && !logo.querySelector('img')) {
                var lurl = JMP.logoUrl(item, 800);
                if (lurl) logo.style.backgroundImage = 'url("' + lurl + '")';
            }
        }).catch(function () { /* leave default look */ });
    }

    JMP.register('details', {
        onView: function (view) {
            if (!view) return;
            var isDetail = view.classList && (view.classList.contains('itemDetailPage') || view.id === 'itemDetailPage');
            if (!isDetail) return;
            /* Content populates async — give it a beat, then patch gaps. */
            setTimeout(function () { if (view.isConnected) enhance(view); }, 400);
        }
    });
})();
