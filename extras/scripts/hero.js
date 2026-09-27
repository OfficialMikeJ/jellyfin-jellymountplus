/* ============================================================
   JellymountPlus — Home Hero
   Injects the cinematic featured hero into the home tab:
   backdrop crossfade, logo/meta/overview, Play/Resume + My List,
   featured poster selector and optional slow auto-rotation.
   All data comes from the user's Jellyfin server via ApiClient.
   ============================================================ */
(function () {
    'use strict';

    var JMP = window.JellymountPlus;
    if (!JMP) return;

    var FADE_MS = 430;
    var BACKDROP_FADE_MS = 900;

    function mount(tabEl) {
        if (tabEl.querySelector('.jmp-hero')) return;

        var hero = JMP.el('div', 'jmp-hero jmp-skeleton');
        hero.setAttribute('data-hero', '');
        hero.innerHTML =
            '<div class="jmp-hero-backdrops">' +
                '<div class="jmp-hero-backdrop" data-layer="0"></div>' +
                '<div class="jmp-hero-backdrop" data-layer="1"></div>' +
            '</div>' +
            '<div class="jmp-hero-gradient jmp-hero-gradient-left"></div>' +
            '<div class="jmp-hero-gradient jmp-hero-gradient-bottom"></div>' +
            '<div class="jmp-hero-gradient jmp-hero-gradient-top"></div>' +
            '<div class="jmp-hero-content">' +
                '<img class="jmp-hero-logo" alt="" hidden>' +
                '<h1 class="jmp-hero-title" hidden></h1>' +
                '<div class="jmp-hero-meta"></div>' +
                '<p class="jmp-hero-overview"></p>' +
            '</div>' +
            '<div class="jmp-hero-selector" data-count="0"></div>';

        var sections = tabEl.querySelector('.sections');
        if (sections) tabEl.insertBefore(hero, sections);
        else tabEl.insertBefore(hero, tabEl.firstChild);

        /* Lets CSS drop the appbar spacer so the hero slides under the
           translucent nav (edge-to-edge look). */
        document.documentElement.classList.add('jmp-hero-active');

        /* Action row uses a real emby-itemscontainer so data-action="play|resume|link"
           buttons get native Jellyfin playback/navigation handling. */
        var actions = JMP.itemsContainer('jmp-hero-actions');
        hero.querySelector('.jmp-hero-content').appendChild(actions);

        var state = {
            items: [],
            index: -1,
            timer: null,
            pausedHover: false,
            pausedIdle: false,
            pausedOffscreen: false,
            activeLayer: 0,
            destroyed: false,
            favBusy: false
        };

        JMP.whenReady(function () {
            if (state.destroyed) return;
            loadFeatured(state, hero);
        });

        wireInteraction(state, hero);
        JMP.onCleanup(function () { destroy(state, hero); });
    }

    /* ---------------- Data ---------------- */

    function loadFeatured(state, hero) {
        var uid = JMP.userId();
        var c = JMP.api();
        if (!uid || !c) return;

        JMP.getJSON('Users/' + uid + '/Items', {
            IncludeItemTypes: 'Movie,Series',
            Recursive: true,
            SortBy: 'DateCreated',
            SortOrder: 'Descending',
            Limit: Math.max(12, (JMP.config.heroItemLimit || 8) * 3),
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Logo,Thumb',
            Fields: JMP.ITEM_FIELDS,
            EnableTotalRecordCount: false,
            ExcludeLocationTypes: 'Virtual'
        }).then(function (result) {
            if (state.destroyed) return;
            var items = (result && result.Items || [])
                .filter(function (i) {
                    return i.BackdropImageTags && i.BackdropImageTags.length && JMP.backdropUrl(i);
                })
                .slice(0, JMP.config.heroItemLimit || 8);

            if (!items.length) {
                hero.remove();
                return;
            }
            state.items = items;
            buildSelector(state, hero);
            select(state, hero, 0, true);
            hero.classList.remove('jmp-skeleton');
            maybeAutoRotate(state, hero);
        }).catch(function (err) {
            JMP.log('hero load failed', err);
            if (!state.destroyed) hero.remove();
        });
    }

    /* For series, the hero play button targets a resumable / next-up episode
       so "Resume" and "Play" always do something truthful. */
    function resolvePlayable(item) {
        if (item.Type !== 'Series') return Promise.resolve(item);
        var uid = JMP.userId();
        return JMP.getJSON('Users/' + uid + '/Items', {
            ParentId: item.Id,
            Recursive: true,
            Filters: 'IsResumable',
            Limit: 1,
            Fields: JMP.ITEM_FIELDS,
            EnableTotalRecordCount: false
        }).then(function (r) {
            var ep = r && r.Items && r.Items[0];
            if (ep) return ep;
            return JMP.getJSON('Shows/NextUp', {
                UserId: uid,
                SeriesId: item.Id,
                Limit: 1,
                Fields: JMP.ITEM_FIELDS
            }).then(function (n) {
                return (n && n.Items && n.Items[0]) || item;
            });
        }).catch(function () { return item; });
    }

    /* ---------------- Rendering ---------------- */

    function buildSelector(state, hero) {
        var track = hero.querySelector('.jmp-hero-selector');
        track.innerHTML = '';
        track.setAttribute('data-count', state.items.length);
        if (state.items.length < 2) return;

        state.items.forEach(function (item, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'jmp-hero-card';
            btn.setAttribute('aria-label', item.Name || '');
            btn.setAttribute('data-index', i);
            var url = JMP.posterUrl(item, 342);
            if (url) {
                var img = document.createElement('img');
                img.src = url;
                img.alt = '';
                img.loading = 'lazy';
                btn.appendChild(img);
            }
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                select(state, hero, i, false);
                pauseAuto(state, hero, true);
            });
            btn.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    e.stopPropagation();
                    var next = i + (e.key === 'ArrowRight' ? 1 : -1);
                    next = (next + state.items.length) % state.items.length;
                    select(state, hero, next, false);
                    var cards = track.querySelectorAll('.jmp-hero-card');
                    if (cards[next]) cards[next].focus();
                    pauseAuto(state, hero, true);
                }
            });
            track.appendChild(btn);
        });
    }

    function renderActions(state, hero, item, playable) {
        var actions = hero.querySelector('.jmp-hero-actions');
        actions.innerHTML = '';

        var resumable = playable && JMP.isResumeable(playable);
        var target = playable || item;
        var play = document.createElement('button');
        play.type = 'button';
        play.className = 'jmp-btn jmp-btn-play itemAction';
        play.innerHTML = '<span class="material-icons jmp-btn-icon" aria-hidden="true">play_arrow</span><span>' +
            JMP.esc(resumable ? 'Resume' : 'Play') + '</span>';
        JMP.applyItemAttrs(play, target, resumable ? 'resume' : 'play');
        actions.appendChild(play);

        /* My List — toggles Jellyfin Favorites. */
        var fav = item.UserData && item.UserData.IsFavorite;
        var mylist = document.createElement('button');
        mylist.type = 'button';
        mylist.className = 'jmp-btn jmp-btn-icon-round jmp-mylist' + (fav ? ' is-saved' : '');
        mylist.setAttribute('aria-label', 'My List');
        mylist.setAttribute('aria-pressed', fav ? 'true' : 'false');
        mylist.title = 'My List';
        mylist.innerHTML = '<span class="material-icons" aria-hidden="true">' +
            (fav ? 'check' : 'add') + '</span>';
        mylist.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            toggleFavorite(state, hero, item, mylist);
        });
        actions.appendChild(mylist);

        var more = document.createElement('a');
        more.className = 'jmp-btn jmp-btn-ghost itemAction';
        more.setAttribute('href', '#/details?id=' + encodeURIComponent(item.Id) +
            (item.ServerId ? '&serverId=' + encodeURIComponent(item.ServerId) : ''));
        more.innerHTML = '<span class="material-icons jmp-btn-icon" aria-hidden="true">info_outline</span><span>More Info</span>';
        actions.appendChild(more);
    }

    function toggleFavorite(state, hero, item, btn) {
        var c = JMP.api();
        if (!c || state.favBusy) return;
        state.favBusy = true;
        var makeFav = !(item.UserData && item.UserData.IsFavorite);
        c.updateFavoriteStatus(item.Id, makeFav).then(function () {
            item.UserData = item.UserData || {};
            item.UserData.IsFavorite = makeFav;
            btn.classList.toggle('is-saved', makeFav);
            btn.setAttribute('aria-pressed', makeFav ? 'true' : 'false');
            btn.querySelector('.material-icons').textContent = makeFav ? 'check' : 'add';
            state.favBusy = false;
        }).catch(function () { state.favBusy = false; });
    }

    function select(state, hero, index, instant) {
        if (state.destroyed || index === state.index || !state.items[index]) return;
        state.index = index;
        var item = state.items[index];

        /* selector highlight */
        var cards = hero.querySelectorAll('.jmp-hero-card');
        Array.prototype.forEach.call(cards, function (c) {
            c.classList.toggle('is-selected', parseInt(c.getAttribute('data-index'), 10) === index);
        });

        /* Keep the selected card inside the scrollable selector's viewport. */
        var track = hero.querySelector('.jmp-hero-selector');
        var selCard = cards[index];
        if (track && selCard && track.scrollWidth > track.clientWidth) {
            var cl = selCard.offsetLeft, cw = selCard.offsetWidth, vw = track.clientWidth;
            if (cl < track.scrollLeft || cl + cw > track.scrollLeft + vw) {
                track.scrollTo({
                    left: cl + cw - vw + 8,
                    behavior: (instant || JMP.reducedMotion()) ? 'auto' : 'smooth'
                });
            }
        }

        /* content fade out → swap → fade in */
        var doSwap = function () {
            var logo = hero.querySelector('.jmp-hero-logo');
            var title = hero.querySelector('.jmp-hero-title');
            var logoSrc = JMP.logoUrl(item, 800);

            if (logoSrc) {
                logo.src = logoSrc;
                logo.alt = item.Name || '';
                logo.hidden = false;
                title.hidden = true;
                title.textContent = '';
            } else {
                logo.hidden = true;
                logo.removeAttribute('src');
                title.hidden = false;
                title.textContent = item.Name || '';
            }

            hero.querySelector('.jmp-hero-meta').innerHTML = JMP.metaChips(item);
            hero.querySelector('.jmp-hero-overview').textContent = item.Overview || '';
            hero.querySelector('.jmp-hero-overview').hidden = !item.Overview;

            resolvePlayable(item).then(function (playable) {
                if (state.destroyed || state.items[state.index] !== item) return;
                renderActions(state, hero, item, playable);
            });

            hero.classList.remove('is-fading');
        };

        /* backdrop crossfade — preload before showing */
        var url = JMP.backdropUrl(item, 1920);
        var layers = hero.querySelectorAll('.jmp-hero-backdrop');
        var next = 1 - state.activeLayer;
        var applyBackdrop = function () {
            if (state.destroyed || state.items[state.index] !== item) return;
            layers[next].style.backgroundImage = url ? 'url("' + url + '")' : 'none';
            layers[next].classList.add('is-active');
            layers[state.activeLayer].classList.remove('is-active');
            state.activeLayer = next;
        };

        if (instant || JMP.reducedMotion()) {
            if (url) {
                var pre = new Image();
                pre.onload = function () { applyBackdrop(); doSwap(); };
                pre.onerror = function () { applyBackdrop(); doSwap(); };
                pre.src = url;
            } else { applyBackdrop(); doSwap(); }
            return;
        }

        hero.classList.add('is-fading');
        var proceed = function () { applyBackdrop(); doSwap(); };
        if (url) {
            var img = new Image();
            var done = false;
            img.onload = function () { if (!done) { done = true; proceed(); } };
            img.onerror = function () { if (!done) { done = true; proceed(); } };
            img.src = url;
            setTimeout(function () { if (!done) { done = true; proceed(); } }, 1500);
        } else {
            setTimeout(proceed, FADE_MS);
        }
    }

    /* ---------------- Auto rotation ---------------- */

    function isPaused(state) {
        return state.pausedHover || state.pausedIdle || state.pausedOffscreen || document.hidden;
    }

    function maybeAutoRotate(state, hero) {
        if (!JMP.config.heroAutoRotate || JMP.reducedMotion() || state.items.length < 2) return;
        var ms = JMP.config.heroRotateMs || 18000;
        state.timer = setInterval(function () {
            if (isPaused(state)) return;
            select(state, hero, (state.index + 1) % state.items.length, false);
        }, ms);
    }

    function pauseAuto(state, hero, untilIdle) {
        state.pausedIdle = true;
        if (untilIdle) {
            clearTimeout(state._resumeT);
            state._resumeT = setTimeout(function () { state.pausedIdle = false; }, (JMP.config.heroRotateMs || 18000) * 0.75);
        }
    }

    function wireInteraction(state, hero) {
        hero.addEventListener('pointerenter', function () { state.pausedHover = true; });
        hero.addEventListener('pointerleave', function () { state.pausedHover = false; });
        hero.addEventListener('focusin', function () { state.pausedHover = true; });
        hero.addEventListener('focusout', function () { state.pausedHover = false; });
        /* Pause rotation while the hero is scrolled off screen. */
        if ('IntersectionObserver' in window) {
            state._io = new IntersectionObserver(function (entries) {
                state.pausedOffscreen = !entries[0].isIntersecting;
            }, { threshold: 0.15 });
            state._io.observe(hero);
        }
    }

    function destroy(state, hero) {
        state.destroyed = true;
        clearInterval(state.timer);
        clearTimeout(state._resumeT);
        if (state._io) state._io.disconnect();
        document.documentElement.classList.remove('jmp-hero-active');
        if (hero.parentNode) hero.parentNode.removeChild(hero);
    }

    /* ---------------- Registration ---------------- */

    JMP.register('hero', {
        onView: function (view) {
            if (!JMP.config.hero) return;
            if (!view || !(view.id === 'indexPage' || view.classList.contains('homePage'))) return;

            var tab = view.querySelector('#homeTab') ||
                        view.querySelector('.tabContent[data-index="0"]');
            if (tab) {
                mount(tab);
            } else {
                JMP.watch(view, function () {
                    return view.querySelector('#homeTab') || view.querySelector('.tabContent[data-index="0"]');
                }, function (hit) { mount(hit); });
            }
        }
    });

    JMP.prime();
})();
