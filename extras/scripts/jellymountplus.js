/* ============================================================
   JellymountPlus — Core bootstrap
   Namespace, config, Jellyfin API helpers and the page/view
   lifecycle that every module plugs into.
   ============================================================ */
(function () {
    'use strict';

    if (window.JellymountPlus && window.JellymountPlus.__loaded) return;

    var JMP = {
        __loaded: true,
        version: '1.0.0',
        modules: {},
        _pageCleanups: [],
        _currentView: null
    };

    /* ---------------- Config ---------------- */

    var DEFAULTS = {
        hero: true,
        heroAutoRotate: true,
        heroRotateMs: 18000,
        heroItemLimit: 8,
        hoverPreview: true,
        hoverPreviewDelayMs: 420,
        railButtons: true,
        logoText: 'JellymountPlus',
        logoUrl: null,            // e.g. 'jellymountplus/assets/logo/jellymountplus.svg'
        debug: false
    };

    function readConfig() {
        var cfg = {};
        try {
            if (window.JellymountPlusConfig) cfg = window.JellymountPlusConfig;
            var stored = localStorage.getItem('jmp-config');
            if (stored) {
                try { cfg = Object.assign(cfg, JSON.parse(stored)); } catch (e) { /* noop */ }
            }
        } catch (e) { /* noop */ }
        return Object.assign({}, DEFAULTS, cfg);
    }

    JMP.config = readConfig();

    JMP.log = function () {
        if (!JMP.config.debug) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[JellymountPlus]');
        console.debug.apply(console, args);
    };

    /* ---------------- API helpers ---------------- */

    function api() {
        if (window.ApiClient) return window.ApiClient;
        var sc = window.ServerConnections;
        if (sc && sc.currentApiClient) {
            try { return sc.currentApiClient(); } catch (e) { return null; }
        }
        return null;
    }
    JMP.api = api;

    JMP.userId = function () {
        var c = api();
        if (!c) return null;
        try { return c.getCurrentUserId(); } catch (e) { return null; }
    };

    JMP.serverId = function () {
        var c = api();
        if (!c) return null;
        try { return c.serverId(); } catch (e) { return null; }
    };

    /* Build a server image URL for an item. */
    JMP.imageUrl = function (item, opts) {
        opts = opts || {};
        var c = api();
        if (!c || !item) return '';
        var type = opts.type || 'Primary';
        var tag = opts.tag;

        if (!tag) {
            if (type === 'Primary') tag = item.ImageTags && item.ImageTags.Primary;
            else if (type === 'Backdrop') tag = item.BackdropImageTags && item.BackdropImageTags[opts.index || 0];
            else if (type === 'Logo') tag = item.ImageTags && item.ImageTags.Logo;
            else if (type === 'Thumb') tag = item.ImageTags && item.ImageTags.Thumb;
        }
        if (!tag) return '';

        var params = {
            tag: tag,
            maxWidth: opts.width || 800,
            quality: opts.quality || 90
        };
        if (opts.maxHeight) params.maxHeight = opts.maxHeight;

        var id = opts.itemId || item.Id;
        var base = 'Items/' + id + '/Images/' + type;
        if (type === 'Backdrop' && (opts.index != null)) base += '/' + opts.index;
        return c.getUrl(base, params);
    };

    /* Backdrop with graceful fallbacks (spec: artwork priority). */
    JMP.backdropUrl = function (item, width) {
        var u = JMP.imageUrl(item, { type: 'Backdrop', index: 0, width: width || 1920, quality: 88 });
        if (u) return u;
        u = JMP.imageUrl(item, { type: 'Thumb', width: width || 1920 });
        if (u) return u;
        u = JMP.imageUrl(item, { type: 'Primary', width: width || 1920 });
        return u || '';
    };

    JMP.logoUrl = function (item, width) {
        return JMP.imageUrl(item, { type: 'Logo', width: width || 800, quality: 90 });
    };

    JMP.posterUrl = function (item, width) {
        var u = JMP.imageUrl(item, { type: 'Primary', width: width || 500 });
        if (!u && item.SeriesId) {
            u = JMP.imageUrl({ Id: item.SeriesId, ImageTags: item.SeriesPrimaryImageTag ? { Primary: item.SeriesPrimaryImageTag } : {} }, { type: 'Primary', width: width || 500 });
        }
        return u || '';
    };

    JMP.thumbUrl = function (item, width) {
        var u = JMP.imageUrl(item, { type: 'Thumb', width: width || 800 });
        if (!u) u = JMP.imageUrl(item, { type: 'Backdrop', index: 0, width: width || 800 });
        if (!u) u = JMP.imageUrl(item, { type: 'Primary', width: width || 800 });
        return u || '';
    };

    /* ---------------- Requests ---------------- */

    JMP.getJSON = function (path, params) {
        var c = api();
        if (!c) return Promise.reject(new Error('no apiclient'));
        return c.getJSON(c.getUrl(path, params));
    };

    JMP.getItem = function (id) {
        var uid = JMP.userId();
        var c = api();
        if (!c || !uid || !id) return Promise.reject(new Error('missing id/user'));
        return c.getItem(uid, id).then ? c.getItem(uid, id) : c.getJSON(c.getUrl('Users/' + uid + '/Items/' + id, { Fields: ITEM_FIELDS }));
    };

    var ITEM_FIELDS = [
        'Overview', 'ProductionYear', 'RunTimeTicks', 'OfficialRating',
        'CommunityRating', 'Genres', 'MediaSourceCount', 'PrimaryImageAspectRatio',
        'SeriesName', 'ParentIndexNumber', 'IndexNumber', 'SeasonName',
        'PremiereDate', 'DateCreated', 'ProviderIds', 'Taglines', 'Studios',
        'ChildCount', 'RecursiveItemCount', 'BackdropImageTags'
    ].join(',');
    JMP.ITEM_FIELDS = ITEM_FIELDS;

    /* ---------------- Formatting ---------------- */

    JMP.esc = function (s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    };

    JMP.fmtRuntime = function (ticks) {
        if (!ticks || ticks <= 0) return '';
        var totalMin = Math.round(ticks / 600000000);
        var h = Math.floor(totalMin / 60);
        var m = totalMin % 60;
        if (h > 0) return h + 'h' + (m ? ' ' + m + 'm' : '');
        return m + 'm';
    };

    JMP.fmtSeasonEp = function (item) {
        if (item.Type !== 'Episode') return '';
        var s = item.ParentIndexNumber != null ? 'S' + item.ParentIndexNumber : '';
        var e = item.IndexNumber != null ? 'E' + item.IndexNumber : '';
        var se = (s && e) ? s + ' ' + e : (s || e);
        var name = item.Name && item.Name !== ('Episode ' + item.IndexNumber) ? ': ' + item.Name : '';
        return se + name;
    };

    /* Age badge from real metadata only (no fabrication). */
    JMP.badgeFor = function (item) {
        var now = Date.now();
        var created = item.DateCreated ? new Date(item.DateCreated).getTime() : 0;
        var premiered = item.PremiereDate ? new Date(item.PremiereDate).getTime() : 0;
        var DAY = 86400000;
        if (item.Type === 'Episode' && premiered && (now - premiered) < 14 * DAY) return 'NEW EPISODE';
        if (item.Type === 'Season' && premiered && (now - premiered) < 30 * DAY) return 'NEW SEASON';
        if (created && (now - created) < 14 * DAY) return 'JUST ADDED';
        if (premiered && (now - premiered) < 30 * DAY) return 'NEW';
        return '';
    };

    /* Meta chips for hero / preview: year · rating · runtime · score */
    JMP.metaChips = function (item) {
        var chips = [];
        var badge = JMP.badgeFor(item);
        if (badge) chips.push('<span class="jmp-badge">' + JMP.esc(badge) + '</span>');
        if (item.ProductionYear) chips.push('<span>' + item.ProductionYear + '</span>');
        if (item.OfficialRating) chips.push('<span class="jmp-meta-badge-age">' + JMP.esc(item.OfficialRating) + '</span>');
        if (item.Type === 'Series' && item.ChildCount) {
            chips.push('<span>' + item.ChildCount + (item.ChildCount === 1 ? ' Season' : ' Seasons') + '</span>');
        } else if (item.Type === 'Episode') {
            var se = JMP.fmtSeasonEp(item).split(':')[0];
            if (se) chips.push('<span>' + JMP.esc(se) + '</span>');
        } else {
            var rt = JMP.fmtRuntime(item.RunTimeTicks);
            if (rt) chips.push('<span>' + rt + '</span>');
        }
        if (item.CommunityRating) {
            chips.push('<span class="jmp-meta-rating">' + (Math.round(item.CommunityRating * 10) / 10) + '</span>');
        }
        return chips.join('');
    };

    /* Card attribute payload reused by injected itemAction elements so
       Jellyfin's own shortcuts/playback machinery handles the clicks.
       (Mirrors getItemInfoFromCard in jellyfin-web components/shortcuts.) */
    JMP.itemDataAttrs = function (item, action) {
        var ticks = (item.UserData && item.UserData.PlaybackPositionTicks) || 0;
        var attrs =
            ' data-id="' + JMP.esc(item.Id) + '"' +
            ' data-serverid="' + JMP.esc(item.ServerId || JMP.serverId() || '') + '"' +
            ' data-type="' + JMP.esc(item.Type || '') + '"' +
            ' data-mediatype="' + JMP.esc(item.MediaType || '') + '"' +
            ' data-isfolder="' + (item.IsFolder ? 'true' : 'false') + '"' +
            ' data-positionticks="' + ticks + '"' +
            ' data-action="' + JMP.esc(action || 'link') + '"';
        if (item.ChannelId) attrs += ' data-channelid="' + JMP.esc(item.ChannelId) + '"';
        if (item.SeriesId) attrs += ' data-seriesid="' + JMP.esc(item.SeriesId) + '"';
        if (item.CollectionType) attrs += ' data-collectiontype="' + JMP.esc(item.CollectionType) + '"';
        return attrs;
    };

    /* Same payload as setAttribute calls on a live element. */
    JMP.applyItemAttrs = function (el, item, action) {
        var ticks = (item.UserData && item.UserData.PlaybackPositionTicks) || 0;
        el.setAttribute('data-id', item.Id);
        el.setAttribute('data-serverid', item.ServerId || JMP.serverId() || '');
        el.setAttribute('data-type', item.Type || '');
        el.setAttribute('data-mediatype', item.MediaType || '');
        el.setAttribute('data-isfolder', item.IsFolder ? 'true' : 'false');
        el.setAttribute('data-positionticks', ticks);
        el.setAttribute('data-action', action || 'link');
        if (item.ChannelId) el.setAttribute('data-channelid', item.ChannelId);
        if (item.SeriesId) el.setAttribute('data-seriesid', item.SeriesId);
        if (item.CollectionType) el.setAttribute('data-collectiontype', item.CollectionType);
    };

    JMP.isResumeable = function (item) {
        var ud = item.UserData;
        return !!(ud && ud.PlaybackPositionTicks > 0);
    };

    JMP.progressPct = function (item) {
        var ud = item.UserData;
        if (!ud || !ud.PlaybackPositionTicks || !item.RunTimeTicks) return 0;
        return Math.min(100, Math.round((ud.PlaybackPositionTicks / item.RunTimeTicks) * 1000) / 10);
    };

    /* ---------------- DOM helpers ---------------- */

    /* Create a real emby-itemscontainer element so descendants with
       class="itemAction" + data-action get native Jellyfin behaviour
       (play / resume / menu / link) inside our injected UI. */
    JMP.itemsContainer = function (className) {
        var el = document.createElement('div', 'emby-itemscontainer');
        el.className = 'itemsContainer ' + (className || '');
        el.setAttribute('data-contextmenu', 'false');
        return el;
    };

    JMP.el = function (tag, className, html) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (html != null) el.innerHTML = html;
        return el;
    };

    JMP.reducedMotion = function () {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    JMP.finePointer = function () {
        return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    };

    /* ---------------- Page / view lifecycle ---------------- */

    function cleanupPage() {
        var fns = JMP._pageCleanups.slice();
        JMP._pageCleanups = [];
        fns.forEach(function (fn) { try { fn(); } catch (e) { console.error('[JellymountPlus] cleanup error', e); } });
        JMP._currentView = null;
    }

    /* Register a page-scoped teardown. */
    JMP.onCleanup = function (fn) {
        JMP._pageCleanups.push(fn);
    };

    /* viewshow bubbles from every React <Page> and legacy view. */
    document.addEventListener('viewshow', function (e) {
        cleanupPage();
        JMP._currentView = e.target;
        var view = e.target;
        Object.keys(JMP.modules).forEach(function (name) {
            var mod = JMP.modules[name];
            if (mod && typeof mod.onView === 'function') {
                try { mod.onView(view, e.detail || {}); } catch (err) { console.error('[JellymountPlus] module "' + name + '" error', err); }
            }
        });
    }, true);

    document.addEventListener('viewhide', cleanupPage, true);
    window.addEventListener('pagehide', cleanupPage);

    /* ---------------- Module registry ---------------- */

    JMP.register = function (name, mod) {
        JMP.modules[name] = mod;
        /* If a view is already active (late script load), prime it now. */
        if (JMP._currentView && mod && typeof mod.onView === 'function') {
            try { mod.onView(JMP._currentView, {}); } catch (e) { console.error('[JellymountPlus]', e); }
        }
    };

    /* Wait until the ApiClient is usable, then run once. */
    JMP.whenReady = function (fn) {
        if (api() && JMP.userId()) { fn(); return; }
        var tries = 0;
        var t = setInterval(function () {
            tries++;
            if (api() && JMP.userId()) {
                clearInterval(t);
                fn();
            } else if (tries > 200) {
                clearInterval(t);
            }
        }, 150);
    };

    /* Scoped, throttled DOM watcher. Returns a disconnect function that is
       also auto-registered for page cleanup. */
    JMP.watch = function (root, predicate, cb, opts) {
        opts = opts || {};
        var fired = false;
        var pending = false;
        var observer = new MutationObserver(function () {
            if (pending) return;
            pending = true;
            setTimeout(function () {
                pending = false;
                if (fired && opts.once !== false) return;
                try {
                    var hit = predicate();
                    if (hit) {
                        if (opts.once !== false) { fired = true; observer.disconnect(); }
                        cb(hit);
                    }
                } catch (e) { console.error('[JellymountPlus] watcher error', e); }
            }, opts.debounceMs || 60);
        });
        observer.observe(root || document.body, { childList: true, subtree: true });
        var disconnect = function () { observer.disconnect(); };
        JMP.onCleanup(disconnect);
        return disconnect;
    };

    /* Prime a module immediately if the matching view is on screen —
       needed when scripts load after navigation already happened. */
    JMP.prime = function () {
        var view = document.querySelector('[data-role="page"]') || document.querySelector('.page');
        if (view && JMP._currentView !== view) {
            JMP._currentView = view;
            Object.keys(JMP.modules).forEach(function (name) {
                var mod = JMP.modules[name];
                if (mod && typeof mod.onView === 'function') {
                    try { mod.onView(view, {}); } catch (e) { console.error('[JellymountPlus]', e); }
                }
            });
        }
    };

    window.JellymountPlus = JMP;
    JMP.log('core loaded');
})();
