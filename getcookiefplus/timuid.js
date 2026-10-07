// OMNEI Pro - UID Extractor Helper (Clean & Store Compliant)

(function () {
    if (window.__omneiUidInjected) return;
    window.__omneiUidInjected = true;

    function extractUidFromUrl(url) {
        if (!url) return null;
        let match = url.match(/[?&]id=(\d+)/);
        if (match) return match[1];
        match = url.match(/\/user\/(\d+)/);
        if (match) return match[1];
        match = url.match(/profile\.php\?id=(\d+)/);
        if (match) return match[1];
        match = url.match(/\/groups\/\d+\/user\/(\d+)/);
        if (match) return match[1];
        return null;
    }

    function scanPageForUids() {
        const userLinks = document.querySelectorAll('a[role="link"]:not([data-omnei-uid-checked]), a[href*="facebook.com"]:not([data-omnei-uid-checked])');
        for (let i = 0; i < userLinks.length; i++) {
            const link = userLinks[i];
            link.setAttribute('data-omnei-uid-checked', '1');
            const href = link.getAttribute('href') || '';
            const uid = extractUidFromUrl(href);
            if (uid && !link.querySelector('.omnei-uid-badge')) {
                const badge = document.createElement('span');
                badge.className = 'omnei-uid-badge';
                badge.title = 'Click để copy UID Facebook: ' + uid;
                badge.innerText = 'UID: ' + uid;
                badge.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(uid).then(() => {
                        badge.innerText = '✓ Đã copy!';
                        setTimeout(() => { badge.innerText = 'UID: ' + uid; }, 1500);
                    });
                });
                link.parentNode.insertBefore(badge, link.nextSibling);
            }
        }
    }

    // Run periodically on dynamic feeds
    setInterval(scanPageForUids, 2000);
    scanPageForUids();
})();