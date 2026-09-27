/* ============================================================
   JellymountPlus — Expanded Hover Preview
   Netflix/P+-style delayed card expansion. One preview at a
   time, collision-aware positioning, proper teardown on
   scroll / escape / navigation.
   ============================================================ */
(function () {
    'use strict';

    var JMP = window.JellymountPlus;
    if (!JMP) return;
    if (!JMP.config.hoverPreview) return;

    var OPEN_DELAY = JMP.config.hoverPreviewDelayMs || 420;
    var EDGE_ZONE = 0.28;          // fraction of viewport treated as an edge
    var VIEWPORT_PAD = 12;         // px clamp padding
    var CARD_QUERY = '.itemsContainer .card[data-id], .card[data-id].itemAction, [is="emby-itemscontainer"] .card[data-id]';

    var openTimer = null;
    var currentCard = null;
    var previewEl = null;
    var currentItemId = null;
    var suppressUntil = 0;

    function cacheBust() { /* noop — kept for clarity */ }

    /* ---------------- Lifecycle ---------------- */

    function schedule(card) {
        cancelTimer();
        if (Date.now() < suppressUntil) return;
        currentCard = card;
        currentItemId = card.getAttribute('data-id');
        openTimer = setTimeout(function () {
            openTimer = null;
            if (currentCard === card && card.isConnected) open(card);
        }, OPEN_DELAY);
    }

    function cancelTimer() {
        clearTimeout(openTimer);
        openTimer = null;
    }

    function close(instant) {
        cancelTimer();
        currentCard = null;
        currentItemId = null;
        if (!previewEl) return;
        var el = previewEl;
        previewEl = null;
        if (instant || JMP.reducedMotion()) {
            el.remove();
        } else {
            el.classList.add('is-closing');
            el.classList.remove('is-open');
            setTimeout(function () { el.remove(); }, 220);
        }
    }

    /* ---------------- Open ---------------- */

    function open(card) {
        var id = card.getAttribute('data-id');
        if (!id) return;
        close(true);
        currentItemId = id;

        JMP.getItem(id).then(function (item) {
            /* Bail if the hover already moved on. */
            if (!currentItemId || currentItemId !== id || !card.isConnected) return;
            render(card, item);
        }).catch(function () { /* preview silently skipped */ });
    }

    function render(card, item) {
        var el = JMP.el('div', 'jmp-preview');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', item.Name || '');

        /* artwork */
        var art = JMP.el('div', 'jmp-preview-art');
        var artUrl = JMP.thumbUrl(item, 780) || JMP.backdropUrl(item, 780);
        if (artUrl) {
            var img = document.createElement('img');
            img.src = artUrl;
            img.alt = '';
            art.appendChild(img);
        }
        var logoUrl = JMP.logoUrl(item, 500);
        if (logoUrl) {
            var logo = document.createElement('img');
            logo.className = 'jmp-preview-logo';
            logo.src = logoUrl;
            logo.alt = '';
            art.appendChild(logo);
        }
        el.appendChild(art);

        /* info */
        var info = JMP.el('div', 'jmp-preview-info');
        var titleText = item.Type === 'Episode' && item.SeriesName ? item.SeriesName : item.Name;
        if (!logoUrl && titleText) {
            info.appendChild(JMP.el('h3', 'jmp-preview-title', JMP.esc(titleText)));
        }

        var meta = JMP.el('div', 'jmp-preview-meta', JMP.metaChips(item));
        if (meta.innerHTML) info.appendChild(meta);

        if (item.Type === 'Episode') {
            var se = JMP.fmtSeasonEp(item);
            if (se) info.appendChild(JMP.el('div', 'jmp-preview-episodeline', JMP.esc(se)));
        }

        if (item.Overview) {
            info.appendChild(JMP.el('p', 'jmp-preview-overview', JMP.esc(item.Overview)));
        }

        /* actions — emby-itemscontainer gives native play/resume/link/menu */
        var actions = JMP.itemsContainer('jmp-preview-actions');
        var resumable = JMP.isResumeable(item);
        var play = document.createElement('button');
        play.type = 'button';
        play.className = 'jmp-btn jmp-btn-play itemAction';
        play.innerHTML = '<span class="material-icons jmp-btn-icon" aria-hidden="true">play_arrow</span><span>' +
            JMP.esc(resumable ? 'Resume' : 'Play') + '</span>';
        JMP.applyItemAttrs(play, item, resumable ? 'resume' : 'play');
        actions.appendChild(play);

        var fav = item.UserData && item.UserData.IsFavorite;
        var mylist = document.createElement('button');
        mylist.type = 'button';
        mylist.className = 'jmp-btn jmp-btn-icon-round jmp-mylist' + (fav ? ' is-saved' : '');
        mylist.title = 'My List';
        mylist.setAttribute('aria-label', 'My List');
        mylist.setAttribute('aria-pressed', fav ? 'true' : 'false');
        mylist.innerHTML = '<span class="material-icons" aria-hidden="true">' + (fav ? 'check' : 'add') + '</span>';
        mylist.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var c = JMP.api();
            if (!c) return;
            var makeFav = !(item.UserData && item.UserData.IsFavorite);
            c.updateFavoriteStatus(item.Id, makeFav).then(function () {
                item.UserData = item.UserData || {};
                item.UserData.IsFavorite = makeFav;
                mylist.classList.toggle('is-saved', makeFav);
                mylist.setAttribute('aria-pressed', makeFav ? 'true' : 'false');
                mylist.querySelector('.material-icons').textContent = makeFav ? 'check' : 'add';
            }).catch(function () { /* noop */ });
        });
        actions.appendChild(mylist);

        var more = document.createElement('a');
        more.className = 'jmp-btn jmp-btn-ghost itemAction';
        more.setAttribute('href', '#/details?id=' + encodeURIComponent(item.Id) +
            (item.ServerId ? '&serverId=' + encodeURIComponent(item.ServerId) : ''));
        more.innerHTML = '<span class="material-icons jmp-btn-icon" aria-hidden="true">info_outline</span>';
        more.setAttribute('aria-label', 'More info');
        actions.appendChild(more);

        info.appendChild(actions);

        /* progress */
        var pct = JMP.progressPct(item);
        if (pct > 0) {
            var bar = JMP.el('div', 'jmp-preview-progress', '<div style="width:' + pct + '%"></div>');
            info.appendChild(bar);
            var remaining = item.RunTimeTicks ? Math.max(0, item.RunTimeTicks - (item.UserData.PlaybackPositionTicks || 0)) : 0;
            if (remaining) {
                info.appendChild(JMP.el('div', 'jmp-preview-progress-meta',
                    JMP.esc(JMP.fmtRuntime(remaining) + ' remaining')));
            }
        }

        el.appendChild(info);
        document.body.appendChild(el);
        previewEl = el;

        position(el, card);

        /* keep open while hovering the preview itself */
        el.addEventListener('pointerleave', function (e) {
            if (card.contains(e.relatedTarget)) return;
            close();
        });

        requestAnimationFrame(function () {
            if (previewEl === el) el.classList.add('is-open');
        });
    }

    /* ---------------- Collision-aware positioning ---------------- */

    function position(el, card) {
        var rect = card.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        /* Width may differ from CSS var if the item is tiny — measure real size. */
        var w = el.offsetWidth;
        var h = el.offsetHeight;

        var centerX = rect.left + rect.width / 2;
        var left;

        if (centerX < vw * EDGE_ZONE) {
            /* left-edge card — grow to the right, aligned to the card */
            left = rect.left - Math.min(6, rect.width * 0.05);
            el.style.setProperty('--jmp-preview-origin', 'left center');
        } else if (centerX > vw * (1 - EDGE_ZONE)) {
            /* right-edge card — grow to the left */
            left = rect.right - w + Math.min(6, rect.width * 0.05);
            el.style.setProperty('--jmp-preview-origin', 'right center');
        } else {
            left = centerX - w / 2;
            el.style.setProperty('--jmp-preview-origin', 'center center');
        }

        left = Math.max(VIEWPORT_PAD, Math.min(left, vw - w - VIEWPORT_PAD));

        /* Prefer vertical centering on the card; clamp inside viewport. */
        var top = rect.top + rect.height / 2 - h / 2;
        top = Math.max(VIEWPORT_PAD, Math.min(top, vh - h - VIEWPORT_PAD));

        el.style.left = left + 'px';
        el.style.top = top + 'px';
    }

    /* ---------------- Delegated hover tracking ---------------- */

    function findCard(el) {
        while (el && el !== document) {
            if (el.nodeType === 1 && el.matches && el.matches(CARD_QUERY)) return el;
            el = el.parentNode;
        }
        return null;
    }

    document.addEventListener('pointerover', function (e) {
        if (e.pointerType === 'touch') return;
        /* Ignore cards inside our own UI (hero selector / preview). */
        if (e.target.closest && e.target.closest('.jmp-preview, .jmp-hero')) return;

        var card = findCard(e.target);
        if (card) {
            if (card !== currentCard) schedule(card);
            return;
        }
        /* Left every card — if we're not over the preview, start closing. */
        if (!previewEl || !previewEl.contains(e.target)) {
            /* Allow movement card→preview without closing. */
            if (currentCard && e.relatedTarget && previewEl && previewEl.contains(e.relatedTarget)) return;
            close();
        }
    }, true);

    document.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;
        if (e.target.closest && e.target.closest('.jmp-preview, .jmp-hero')) return;
        var card = findCard(e.target);
        if (card && card === currentCard) {
            if (previewEl && e.relatedTarget && previewEl.contains(e.relatedTarget)) return;
            close();
        }
    }, true);

    /* ---------------- Close triggers ---------------- */

    window.addEventListener('scroll', function () { close(true); }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            close();
            suppressUntil = Date.now() + 400;
        }
    }, true);

    /* Fresh hover after navigation */
    JMP.register('hoverPreview', {
        onView: function () {
            close(true);
            suppressUntil = Date.now() + 350;
        }
    });
})();
