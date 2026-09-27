/* ============================================================
   JellymountPlus — Content Rails behaviour
   Edge-peek detection, keyboard arrow navigation between cards
   and real-metadata badges (one batched request per row).
   ============================================================ */
(function () {
    'use strict';

    var JMP = window.JellymountPlus;
    if (!JMP) return;

    var processedContainers = (typeof WeakSet !== 'undefined') ? new WeakSet() : { add: function(){}, has: function(){return false;} };
    var pendingFetch = null;
    var pendingIds = new Set();
    var idBadgeMap = {};

    /* ---------------- Edge peek / has-more ---------------- */

    function refreshSectionFlags() {
        var sections = document.querySelectorAll('.verticalSection');
        Array.prototype.forEach.call(sections, function (section) {
            var scroller = section.querySelector('[is="emby-scroller"]') || section.querySelector('.emby-scroller');
            if (!scroller) return;
            var slider = scroller.querySelector('.scrollSlider') || scroller;
            var overflow = slider.scrollWidth > scroller.clientWidth + 8;
            section.classList.toggle('jmp-has-more', overflow);
        });
    }

    var resizeT = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(refreshSectionFlags, 200);
    }, { passive: true });

    /* ---------------- Keyboard navigation between cards ---------------- */

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var card = e.target.closest && e.target.closest('.itemsContainer .card');
        if (!card) return;
        if (e.target.closest('.jmp-preview')) return;

        var dir = e.key === 'ArrowRight' ? 1 : -1;
        var rail = card.parentNode;
        var cards = rail.querySelectorAll(':scope > .card, :scope > .cardBox');
        var idx = Array.prototype.indexOf.call(cards, card);
        var next = cards[idx + dir];
        if (!next) return;

        e.preventDefault();
        e.stopPropagation();
        var target = next.matches('.card') ? (next.querySelector('.cardImageContainer, a, button') || next) : next;
        if (target.focus) target.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: JMP.reducedMotion() ? 'auto' : 'smooth' });
    }, true);

    /* ---------------- Real-metadata badges ---------------- */

    function queueBadgeFetch(ids) {
        ids.forEach(function (id) { pendingIds.add(id); });
        clearTimeout(pendingFetch);
        pendingFetch = setTimeout(flushBadgeFetch, 120);
    }

    function flushBadgeFetch() {
        var uid = JMP.userId();
        if (!uid || !pendingIds.size) return;
        var all = Array.from(pendingIds);
        var ids = all.slice(0, 40);
        pendingIds = new Set(all.slice(40));
        JMP.log('badge fetch for', ids.length, 'items');
        JMP.getJSON('Users/' + uid + '/Items', {
            Ids: ids.join(','),
            Fields: 'DateCreated,PremiereDate,Type',
            EnableTotalRecordCount: false
        }).then(function (r) {
            (r && r.Items || []).forEach(function (item) {
                var b = JMP.badgeFor(item);
                if (b) idBadgeMap[item.Id] = b;
            });
            applyBadges();
            if (pendingIds.size) flushBadgeFetch();
        }).catch(function (e) { JMP.log('badge fetch failed', e); });
    }

    function applyBadges() {
        Object.keys(idBadgeMap).forEach(function (id) {
            var badge = idBadgeMap[id];
            if (!badge) return;
            var cards = document.querySelectorAll('.card[data-id="' + id + '"]');
            Array.prototype.forEach.call(cards, function (card) {
                if (card.querySelector('.jmp-card-badge')) return;
                var scalable = card.querySelector('.cardScalable') || card;
                var tag = JMP.el('span', 'jmp-card-badge jmp-badge', JMP.esc(badge));
                scalable.appendChild(tag);
            });
        });
    }

    function processContainer(container) {
        if (processedContainers.has(container)) return;
        processedContainers.add(container);

        var cards = container.querySelectorAll('.card[data-id]');
        var ids = [];
        for (var i = 0; i < cards.length && i < 12; i++) {
            ids.push(cards[i].getAttribute('data-id'));
        }
        JMP.log('rail container: ' + cards.length + ' cards');
        if (ids.length) queueBadgeFetch(ids);
    }

    function scan(root) {
        var containers = (root || document).querySelectorAll(
            '.verticalSection .itemsContainer, .sections .itemsContainer, .itemsContainer[data-parentid]'
        );
        Array.prototype.forEach.call(containers, processContainer);
        refreshSectionFlags();
    }

    /* ---------------- Module ---------------- */

    JMP.register('rails', {
        onView: function (view) {
            /* Sections render async — watch for containers appearing. */
            JMP.watch(view, function () {
                var c = view.querySelectorAll('.verticalSection .itemsContainer, .sections .itemsContainer');
                return c.length ? c : null;
            }, function () {
                scan(view);
            }, { once: false, debounceMs: 250 });

            scan(view);
        }
    });

    JMP.prime();
})();
