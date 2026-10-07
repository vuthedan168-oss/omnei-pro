// OMNEI Pro - Frontend Controller
// Fast, robust, responsive event binding and state management

var listAccount = [];
var currentCookie = "";
var currentUid = "";
var currentUrl = "";
var selectedPlatform = "all";

var currentLicense = {
    tier: 'FREE',
    planName: 'Gói Miễn Phí (2 Tài khoản)',
    maxAccounts: 2,
    expiresText: 'Vĩnh viễn (Trọn đời)',
    key: 'OMNEI-FREE-STARTER'
};
var currentMachineId = '';
var selectedUpgradeAccounts = 3;
var selectedUpgradePrice = 5000;

function getMaxAllowedAccounts() {
    if (!currentLicense) return 2;
    if (currentLicense.tier === 'ENTERPRISE' || currentLicense.tier === 'VIP') return 999999;
    if (typeof currentLicense.maxAccounts === 'number') return currentLicense.maxAccounts;
    if (currentLicense.tier === 'PRO') return (currentLicense.maxAccounts || 999999);
    return 2;
}

function updateQuotaUI() {
    const max = getMaxAllowedAccounts();
    const count = listAccount.length;
    const isFree = (max <= 2);

    const text = max >= 999999 ? `${count} / Không giới hạn` : `${count} / ${max} Acc`;
    $('#quota_text_display').text(text);
    const pct = max >= 999999 ? Math.min(100, count * 5) : Math.min(100, Math.round((count / max) * 100));
    $('#quota_bar_fill').css('width', `${pct}%`);
    if (pct >= 100) {
        $('#quota_bar_fill').addClass('danger');
    } else {
        $('#quota_bar_fill').removeClass('danger');
    }

    if (isFree) {
        $('#tab1_quota_banner').show();
        $('#tab1_quota_text').text(`${count}/2 Tài Khoản (Gói Free)`);
    } else {
        $('#tab1_quota_banner').hide();
    }

    $('#header_license_badge').text(currentLicense.tier || 'FREE');
    if (currentLicense.tier === 'FREE') {
        $('#header_license_badge').css({ background: '#475569', color: '#f8fafc' });
    } else {
        $('#header_license_badge').css({ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#fff' });
    }
}

function updatePaymentDetails() {
    const mach = currentMachineId || 'OMN-DEVICE';
    let memo = '';
    let amountText = '';

    if (selectedUpgradeAccounts === 'unlimited' || selectedUpgradeAccounts >= 999999) {
        amountText = '99,000 VNĐ';
        memo = `OMNEI ${mach} VIP`;
    } else {
        const accs = parseInt(selectedUpgradeAccounts, 10) || 3;
        const price = (accs <= 3) ? 5000 : (accs - 2) * 5000;
        amountText = price.toLocaleString('vi-VN') + ' VNĐ';
        memo = `OMNEI ${mach} ${accs}ACC`;
    }

    $('#qr_pay_amount').text(amountText);
    $('#qr_pay_memo').text(memo);
    $('#modal_pay_amount').text(amountText);
    $('#modal_pay_memo').text(memo);
}

function showUpgradePaywallModal(attemptedTotal = 0) {
    $('#modal_upgrade_paywall').addClass('active');
    $('#modal_machine_id_display').text(currentMachineId || 'OMN-DEVICE');
    updatePaymentDetails();
}

function isAdditionAllowed(additionalCount = 1) {
    const max = getMaxAllowedAccounts();
    if (listAccount.length + additionalCount > max) {
        showUpgradePaywallModal(listAccount.length + additionalCount);
        return false;
    }
    return true;
}

// Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Get Active Tab safely
async function getCurrentTab() {
    try {
        let queryOptions = { active: true, currentWindow: true };
        let [tab] = await chrome.tabs.query(queryOptions);
        return tab;
    } catch (e) {
        return null;
    }
}

function extractHostname(url) {
    if (!url) return "";
    try {
        const u = new URL(url);
        return u.hostname;
    } catch (e) {
        return url;
    }
}

async function getCookieStoreId(tabOrId) {
    try {
        let tab = null;
        let tabId = null;
        let isIncognito = false;

        if (typeof tabOrId === 'object' && tabOrId !== null) {
            tab = tabOrId;
            tabId = tab.id;
            isIncognito = !!tab.incognito;
        } else if (typeof tabOrId === 'number') {
            tabId = tabOrId;
            try {
                tab = await chrome.tabs.get(tabId);
                isIncognito = !!tab?.incognito;
            } catch (e) {}
        } else {
            tab = await getCurrentTab();
            tabId = tab?.id;
            isIncognito = !!tab?.incognito;
        }

        const stores = await chrome.cookies.getAllCookieStores();
        if (tabId) {
            const found = stores.find(s => s.tabIds && s.tabIds.includes(tabId));
            if (found) return found.id;
        }

        if (isIncognito) {
            const incognitoStore = stores.find(s => s.id !== "0");
            return incognitoStore ? incognitoStore.id : "1";
        }
        return "0";
    } catch (e) {
        return (tabOrId && tabOrId.incognito) ? "1" : "0";
    }
}

function parseCookieString(rawCookie) {
    const list = [];
    const seen = new Set();
    const trimmed = (rawCookie || "").trim();

    // Support JSON array format (e.g. from Cookie-Editor, J2Team, EditThisCookie)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    if (item && item.name && item.value !== undefined) {
                        const name = String(item.name).trim();
                        let value = String(item.value).trim();
                        if (name === 'useragent' || name === '_uafec' || name === 'tlp_ls' || name === 'z_uuid') continue;
                        if (!seen.has(name)) {
                            seen.add(name);
                            list.push({ name, value });
                        }
                    }
                }
                if (list.length > 0) return list;
            }
        } catch (e) {}
    }

    // Standard string format: "c_user=...; xs=...; datr=..."
    const parts = trimmed.split(';');
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const name = part.substring(0, eqIdx).trim();
        let value = part.substring(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
            value = value.substring(1, value.length - 1);
        }
        if (name === 'useragent' || name === '_uafec' || name === 'tlp_ls' || name === 'z_uuid') continue;
        if (!seen.has(name)) {
            seen.add(name);
            list.push({ name, value });
        }
    }
    return list;
}

// Cookie Removal (Safely cleans leading dots with target storeId)
async function removeAllCookies(dm, storeId = null) {
    try {
        const query = { domain: dm };
        if (storeId) query.storeId = storeId;
        const cookies = await chrome.cookies.getAll(query);
        for (const cookie of cookies) {
            let domain = cookie.domain;
            while (domain.startsWith('.')) {
                domain = domain.substring(1);
            }
            const protocol = cookie.secure ? "https://" : "http://";
            const url = protocol + domain + cookie.path;
            try {
                const removeParams = {
                    url: url,
                    name: cookie.name,
                    storeId: cookie.storeId || storeId || undefined
                };
                await chrome.cookies.remove(removeParams);
            } catch (err) {}
        }
    } catch (e) {
        console.warn("removeAllCookies warning:", e);
    }
}

// Helper to set Facebook Cookie reliably into specified store
async function setFacebookCookie(name, value, storeId, expirationDate) {
    const base = {
        url: "https://www.facebook.com/",
        name: name,
        value: value,
        path: "/",
        secure: true,
        expirationDate: expirationDate
    };
    if (storeId) {
        base.storeId = storeId;
    }

    // 1. Try with domain .facebook.com and sameSite no_restriction
    try {
        const res = await chrome.cookies.set({
            ...base,
            domain: ".facebook.com",
            sameSite: "no_restriction"
        });
        if (res) return res;
    } catch (e) {}

    // 2. Try with domain .facebook.com without sameSite
    try {
        const res = await chrome.cookies.set({
            ...base,
            domain: ".facebook.com"
        });
        if (res) return res;
    } catch (e) {}

    // 3. Try with domain facebook.com
    try {
        const res = await chrome.cookies.set({
            ...base,
            domain: "facebook.com"
        });
        if (res) return res;
    } catch (e) {}

    // 4. Try host-only
    try {
        const res = await chrome.cookies.set(base);
        if (res) return res;
    } catch (e) {}

    return null;
}

// Clean Account Switch Engine (Multi-Platform Support)
async function cleanSwitchFacebook(account) {
    try {
        await chrome.storage.local.set({ is_switching: true });
        const platform = account.platform || 'facebook';
        showToast(`Đang chuyển sang: ${account.name || account.uid} (${platform.toUpperCase()})...`, 'info');

        // 1. Configure Proxy
        if (account.proxy && account.proxy.enabled && account.proxy.host) {
            chrome.runtime.sendMessage({ action: 'SET_PROXY', proxy: account.proxy }).catch(() => {});
        } else {
            chrome.runtime.sendMessage({ action: 'CLEAR_PROXY' }).catch(() => {});
        }

        // 2. Configure User-Agent
        if (account.userAgent) {
            chrome.runtime.sendMessage({ action: 'SET_USER_AGENT', userAgent: account.userAgent }).catch(() => {});
        } else {
            chrome.runtime.sendMessage({ action: 'SET_USER_AGENT', userAgent: null }).catch(() => {});
        }

        let tab = await getCurrentTab();
        const storeId = await getCookieStoreId(tab);

        let domain = "facebook.com";
        let targetUrl = "https://www.facebook.com/";
        if (platform === 'tiktok') { domain = "tiktok.com"; targetUrl = "https://www.tiktok.com/"; }
        else if (platform === 'shopee') { domain = "shopee.vn"; targetUrl = "https://shopee.vn/"; }
        else if (platform === 'x') { domain = "x.com"; targetUrl = "https://x.com/"; }

        // 3. Cleanly Delete Existing Cookies for current domain and store
        await removeAllCookies(domain, storeId);

        // 4. Set New Account Cookies into current store
        const parsed = parseCookieString(account.cookie);
        const expirationDate = (Date.now() / 1000) + 31556926; // 1 year

        for (const c of parsed) {
            try {
                await chrome.cookies.set({
                    url: targetUrl,
                    name: c.name,
                    value: c.value,
                    domain: "." + domain,
                    path: "/",
                    secure: true,
                    storeId: storeId,
                    expirationDate: expirationDate
                });
            } catch(e) {}
        }

        // 5. Redirect or open platform URL
        if (tab && tab.id) {
            await chrome.tabs.update(tab.id, { url: targetUrl });
        } else {
            chrome.tabs.create({ url: targetUrl });
        }

        showToast(`Đã chuyển sang ${account.name || account.uid} thành công!`, "success");

        // Refresh current cookie display
        setTimeout(() => {
            loadCurrentCookie();
        }, 1500);

        // 8. Release switching lock
        setTimeout(async () => {
            await chrome.storage.local.set({ is_switching: false });
        }, 4500);
    } catch (e) {
        showToast("Lỗi chuyển nick: " + e.message, "danger");
        await chrome.storage.local.set({ is_switching: false });
    }
}

// Clean Logout Engine
async function cleanLogoutFacebook() {
    try {
        await chrome.storage.local.set({ is_switching: true });
        chrome.runtime.sendMessage({ action: 'CLEAR_PROXY' }).catch(() => {});
        chrome.runtime.sendMessage({ action: 'SET_USER_AGENT', userAgent: null }).catch(() => {});

        let tab = await getCurrentTab();
        const storeId = await getCookieStoreId(tab);

        if (tab && tab.id && tab.url && tab.url.includes('facebook.com')) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        try { localStorage.clear(); } catch(e) {}
                        try { sessionStorage.clear(); } catch(e) {}
                        try {
                            if (window.indexedDB && window.indexedDB.databases) {
                                window.indexedDB.databases().then(dbs => {
                                    for (let db of dbs) {
                                        if (db.name) window.indexedDB.deleteDatabase(db.name);
                                    }
                                }).catch(() => {});
                            }
                        } catch(e) {}
                    }
                });
            } catch(e) {}
        }

        if (chrome.browsingData && chrome.browsingData.remove && !tab?.incognito) {
            try {
                await chrome.browsingData.remove({
                    origins: [
                        "https://www.facebook.com",
                        "https://web.facebook.com",
                        "https://m.facebook.com",
                        "https://mbasic.facebook.com",
                        "https://business.facebook.com"
                    ]
                }, {
                    cache: true,
                    indexedDB: true,
                    localStorage: true,
                    serviceWorkers: true
                });
            } catch(e) {}
        }

        await removeAllCookies("facebook.com", storeId);

        if (tab && tab.id) {
            await chrome.tabs.update(tab.id, { url: "https://www.facebook.com/" });
        } else {
            chrome.tabs.create({ url: "https://www.facebook.com/" });
        }

        showToast("Đã dọn sạch phiên và đăng xuất Facebook!", "success");

        setTimeout(() => {
            loadCurrentCookie();
        }, 1500);

        setTimeout(async () => {
            await chrome.storage.local.set({ is_switching: false });
        }, 3500);
    } catch(e) {
        showToast("Lỗi đăng xuất: " + e.message, "danger");
        await chrome.storage.local.set({ is_switching: false });
    }
}

// Check Live Status for Single Account
async function checkAccountLive(account, updateUI = true) {
    const card = $(`#acc_card_${account.uid}`);
    const tagLive = card.find('.tag-live-status');
    tagLive.html('<span class="spinner"></span> Đang check...').removeClass('tag-live tag-die');

    try {
        const result = await chrome.runtime.sendMessage({
            action: 'CHECK_COOKIE_LIVE',
            cookie: account.cookie
        });

        const isLive = result && result.live === true;
        account.status = isLive ? 'live' : 'die';
        account.statusCheckedAt = Date.now();

        // Auto-heal account name if missing or UID
        if (result && result.name && (!account.name || account.name === account.uid)) {
            account.name = result.name;
            card.find('.account-name').text(account.name).attr('title', account.name);
        } else if (!account.name || account.name === account.uid) {
            try {
                const resName = await chrome.runtime.sendMessage({ action: 'RESOLVE_NAME', uid: account.uid });
                if (resName && resName.name && resName.name !== account.uid) {
                    account.name = resName.name;
                    card.find('.account-name').text(account.name).attr('title', account.name);
                }
            } catch (e) {}
        }

        await saveAccountsToStorage();

        if (updateUI) {
            if (isLive) {
                tagLive.html('● Live').addClass('tag-live').removeClass('tag-die');
                showToast(`${account.name || ('UID ' + account.uid)}: Cookie Live!`, 'success');
            } else {
                tagLive.html('● Die / Checkpoint').addClass('tag-die').removeClass('tag-live');
                showToast(`${account.name || ('UID ' + account.uid)}: ${result?.reason || 'Die'}`, 'danger');
            }
        }
        return isLive;
    } catch (e) {
        tagLive.html('● Lỗi').addClass('tag-die').removeClass('tag-live');
        return false;
    }
}

// Check All Accounts
async function checkAllLive() {
    if (listAccount.length === 0) {
        showToast("Chưa có tài khoản nào để kiểm tra!", "info");
        return;
    }
    const btn = $('#btn_check_all_live');
    btn.prop('disabled', true).html('<span class="spinner"></span> Đang check...');
    showToast(`Bắt đầu check ${listAccount.length} tài khoản...`, "info");

    let liveCount = 0;
    let dieCount = 0;

    for (let acc of listAccount) {
        try {
            const isLive = await checkAccountLive(acc, true);
            if (isLive) liveCount++; else dieCount++;
        } catch (e) {
            dieCount++;
        }
        await new Promise(r => setTimeout(r, 350));
    }

    btn.prop('disabled', false).html('🔄 Check All Live');
    showToast(`Kiểm tra xong! Live: ${liveCount} | Die: ${dieCount}`, liveCount > 0 ? "success" : "danger");
}

// Save Accounts to Local Storage
async function saveAccountsToStorage() {
    try {
        await chrome.storage.local.set({ listaccount: listAccount });
        localStorage.setItem("listaccount", JSON.stringify(listAccount));
        updateShareDropdown();
    } catch(e) {}
}

// Render Account Cards
function renderAccountList(filterText = '') {
    const container = $("#account_list");
    container.empty();

    const search = (filterText || '').toLowerCase().trim();
    const filtered = listAccount.filter(acc => {
        const platform = acc.platform || 'facebook';
        if (selectedPlatform !== 'all' && platform !== selectedPlatform) return false;
        if (!search) return true;
        const name = (acc.name || '').toLowerCase();
        const uid = (acc.uid || '').toLowerCase();
        const note = (acc.note || '').toLowerCase();
        const proxyStr = acc.proxy ? `${acc.proxy.host}:${acc.proxy.port}`.toLowerCase() : '';
        return name.includes(search) || uid.includes(search) || proxyStr.includes(search) || note.includes(search);
    });

    $('#tab_acc_count').text(listAccount.length);
    updateQuotaUI();

    if (filtered.length === 0) {
        $('#account_empty_state').show();
        return;
    } else {
        $('#account_empty_state').hide();
    }

    filtered.forEach(acc => {
        const platform = acc.platform || 'facebook';
        let platformBadge = `<span class="platform-badge platform-facebook">🔵 FB</span>`;
        if (platform === 'tiktok') platformBadge = `<span class="platform-badge platform-tiktok">🎵 TikTok</span>`;
        else if (platform === 'shopee') platformBadge = `<span class="platform-badge platform-shopee">🟠 Shopee</span>`;
        else if (platform === 'x') platformBadge = `<span class="platform-badge platform-x">🐦 X</span>`;

        let avatarUrl = `https://graph.facebook.com/${acc.uid}/picture?type=square`;
        if (platform !== 'facebook') {
            avatarUrl = 'brand_logo.png';
        }

        let statusBadge = '<span class="tag tag-live-status">⚪ Chưa check</span>';
        if (acc.status === 'live') {
            statusBadge = '<span class="tag tag-live tag-live-status">● Live</span>';
        } else if (acc.status === 'die') {
            statusBadge = '<span class="tag tag-die tag-live-status">● Die</span>';
        }

        const proxyTag = (acc.proxy && acc.proxy.enabled && acc.proxy.host)
            ? `<span class="tag tag-proxy" title="Proxy: ${acc.proxy.scheme}://${acc.proxy.host}:${acc.proxy.port}">🛡️ ${acc.proxy.host}:${acc.proxy.port}</span>`
            : '';

        const teamTag = acc.fromTeam ? '<span class="tag tag-team" title="Tài khoản chia sẻ từ đội nhóm">👥 Team</span>' : '';

        const noteTag = acc.note ? `<div class="account-note-text" title="Ghi chú cá nhân">📌 ${$('<div>').text(acc.note).html()}</div>` : '';

        const totpTag = acc.twoFactorSecret ? `
            <div class="totp-container">
                <div class="totp-badge" data-uid="${acc.uid}" data-secret="${acc.twoFactorSecret}" title="Click để sao chép mã OTP 6 số">
                    <span class="totp-icon">🔑</span>
                    <span class="totp-code" id="totp_code_${acc.uid}">------</span>
                    <span class="totp-timer" id="totp_timer_${acc.uid}">30s</span>
                    <span class="btn-copy-totp-icon">📋</span>
                </div>
            </div>
        ` : '';

        const card = $(`
            <div id="acc_card_${acc.uid}" class="account-card" data-uid="${acc.uid}">
                <div class="card-top">
                    <img class="account-avatar" src="${avatarUrl}" onerror="this.src='brand_logo.png'" alt="Avatar">
                    <div class="account-info">
                        <div class="account-name-row">
                            ${platformBadge}
                            <span class="account-name" title="${acc.name || acc.uid}">${acc.name || acc.uid}</span>
                            <button class="btn-rename-acc" title="Đổi tên gợi nhớ" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:11px; padding:0 3px; line-height:1;">✏️</button>
                            ${statusBadge}
                        </div>
                        <div class="account-uid" title="Click để copy UID">
                            <span>UID: ${acc.uid}</span>
                            <span style="font-size: 9px; opacity: 0.7;">📋</span>
                        </div>
                        ${noteTag}
                        ${totpTag}
                        <div class="account-tags" style="margin-top: 4px;">
                            ${proxyTag}
                            ${teamTag}
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-switch btn-action-switch">🚀 Vào Nick</button>
                    <button class="btn-icon btn-isolated-win btn-action-isolated" title="Mở trong Cửa Sổ Container Ẩn Danh Riêng (Chạy đồng thời nhiều nick)">🌐 Tab Riêng</button>
                    <div class="btn-icon-group">
                        <button class="btn-icon btn-action-check" title="Kiểm tra Live/Die & Tên">🔄</button>
                        <button class="btn-icon btn-action-proxy" title="Cấu hình Proxy, 2FA, Ghi chú & UA">⚙️</button>
                        <button class="btn-icon btn-action-share" title="Chia sẻ cho nhân viên">🔗</button>
                        <button class="btn-icon danger btn-action-delete" title="Xóa tài khoản">🗑️</button>
                    </div>
                </div>
            </div>
        `);

        // Events
        card.find('.btn-rename-acc').on('click', async (e) => {
            e.stopPropagation();
            const currentName = (acc.name && acc.name !== acc.uid) ? acc.name : "";
            const newName = prompt(`Nhập tên mới cho tài khoản (UID: ${acc.uid}):`, currentName);
            if (newName !== null) {
                const trimmed = newName.trim();
                acc.name = trimmed || acc.uid;
                await saveAccountsToStorage();
                renderAccountList($('#acc_search_input').val());
                showToast("Đã cập nhật tên tài khoản!", "success");
            }
        });

        card.find('.account-uid').on('click', () => {
            navigator.clipboard.writeText(acc.uid);
            showToast(`Đã copy UID: ${acc.uid}`, 'success');
        });

        card.find('.totp-badge').on('click', async function (e) {
            e.stopPropagation();
            const secret = $(this).data('secret');
            if (!secret) return;
            const res = await CryptoUtils.generateTOTP(secret);
            if (res && res.otp) {
                navigator.clipboard.writeText(res.otp);
                showToast(`Đã copy mã 2FA: ${res.otp} (${res.remaining}s)`, 'success');
            }
        });

        card.find('.btn-switch').on('click', () => {
            cleanSwitchFacebook(acc);
        });

        card.find('.btn-action-isolated').on('click', async () => {
            showToast(`Đang mở ${acc.name || acc.uid} trong container độc lập...`, 'info');
            const res = await chrome.runtime.sendMessage({ action: 'OPEN_ISOLATED_WINDOW', account: acc });
            if (res && res.success) {
                showToast("Đã mở cửa sổ container riêng biệt thành công!", "success");
            } else {
                showToast("Lỗi mở container: " + (res?.error || "Không hỗ trợ"), "danger");
            }
        });

        card.find('.btn-action-check').on('click', () => {
            checkAccountLive(acc, true);
        });

        card.find('.btn-action-proxy').on('click', () => {
            openProxyModal(acc);
        });

        card.find('.btn-action-share').on('click', () => {
            $('[data-tab="tab_team"]').trigger('click');
            $('#share_select_account').val(acc.uid);
        });

        card.find('.btn-action-delete').on('click', async () => {
            if (confirm(`Bạn có chắc muốn xóa tài khoản ${acc.name || acc.uid}?`)) {
                listAccount = listAccount.filter(a => a.uid !== acc.uid);
                await saveAccountsToStorage();
                renderAccountList($('#acc_search_input').val());
                showToast("Đã xóa tài khoản", "info");
            }
        });

        container.append(card);
    });

    updateAllTOTPCodes();
}

// Dynamic 2FA TOTP Real-Time Calculator
async function updateAllTOTPCodes() {
    const badges = $('.totp-badge');
    if (badges.length === 0) return;

    for (let i = 0; i < badges.length; i++) {
        const el = $(badges[i]);
        const secret = el.data('secret');
        const uid = el.data('uid');
        if (!secret) continue;

        try {
            const res = await CryptoUtils.generateTOTP(secret);
            if (res && res.otp) {
                $(`#totp_code_${uid}`).text(res.otp);
                $(`#totp_timer_${uid}`).text(`${res.remaining}s`);
            }
        } catch (e) {}
    }
}

// Update Team Share Account Select Dropdown
function updateShareDropdown() {
    const select = $('#share_select_account');
    select.empty();
    if (listAccount.length === 0) {
        select.append('<option value="">Chưa có tài khoản nào</option>');
        return;
    }
    listAccount.forEach(acc => {
        select.append(`<option value="${acc.uid}">${acc.name || acc.uid} (${acc.uid})</option>`);
    });
}

// Open Proxy, 2FA & Account Config Modal
function openProxyModal(account) {
    $('#proxy_modal_uid').val(account.uid);
    $('#proxy_modal_acc_name').text(`${account.name || account.uid} (UID: ${account.uid})`);

    const p = account.proxy || {};
    $('#proxy_enable_toggle').prop('checked', !!p.enabled);
    if (p.enabled) {
        $('#proxy_inputs_wrapper').show();
    } else {
        $('#proxy_inputs_wrapper').hide();
    }

    $('#proxy_host').val(p.host || '');
    $('#proxy_port').val(p.port || '');
    $('#proxy_scheme').val(p.scheme || 'http');
    $('#proxy_user').val(p.username || '');
    $('#proxy_pass').val(p.password || '');
    $('#proxy_modal_ua').val(account.userAgent || navigator.userAgent);
    $('#proxy_modal_2fa').val(account.twoFactorSecret || '');
    $('#proxy_modal_note').val(account.note || '');

    $('#modal_proxy').addClass('active');
}

// Close Modal
function closeProxyModal() {
    $('#modal_proxy').removeClass('active');
}

// Telegram Security Consent & Authorization Controls
var isTgConsentGranted = false;
var tgConsentTimestamp = 0;

function updateTelegramConsentUI() {
    if (isTgConsentGranted) {
        $('#tg_consent_badge')
            .removeClass('badge-unverified')
            .addClass('badge-verified')
            .html('🛡️ Đã Cấp Quyền');

        $('#tg_consent_status_banner')
            .removeClass('unverified-box')
            .addClass('verified-box');

        $('#tg_consent_icon').text('🛡️');
        $('#tg_consent_banner_title')
            .css('color', '#34d399')
            .text('ĐÃ XÁC NHẬN ỦY QUYỀN BẢO MẬT (CONSENT GRANTED)');

        const dateStr = tgConsentTimestamp ? new Date(tgConsentTimestamp).toLocaleString('vi-VN') : 'Đã xác thực';
        $('#tg_consent_banner_desc').html(`Bạn đã xác nhận đồng ý gửi cookie tự động lúc: <strong>${dateStr}</strong>. Dữ liệu được mã hóa truyền tải an toàn.`);

        $('#btn_open_tg_consent').text('🔍 Xem Lại Điều Khoản');
        $('#btn_tg_revoke_consent').show();
        $('#tg_auto_send_tag').text('Đã cấp quyền').css({
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399'
        });
        $('#tg_auto_send').prop('disabled', false);
    } else {
        $('#tg_consent_badge')
            .removeClass('badge-verified')
            .addClass('badge-unverified')
            .html('⚠️ Chưa Cấp Quyền');

        $('#tg_consent_status_banner')
            .removeClass('verified-box')
            .addClass('unverified-box');

        $('#tg_consent_icon').text('⚠️');
        $('#tg_consent_banner_title')
            .css('color', '#fbbf24')
            .text('YÊU CẦU ỦY QUYỀN BẢO MẬT');

        $('#tg_consent_banner_desc').text('Để bảo vệ tài khoản và tuân thủ tiêu chuẩn an toàn, tính năng tự động gửi cookie chỉ hoạt động khi bạn xác nhận đồng ý cấp quyền.');

        $('#btn_open_tg_consent').text('📋 Xem & Xác Nhận Cấp Quyền');
        $('#btn_tg_revoke_consent').hide();
        $('#tg_auto_send_tag').text('Cần cấp quyền').css({
            background: 'rgba(245, 158, 11, 0.2)',
            color: '#fbbf24'
        });
        $('#tg_auto_send').prop('checked', false);
    }
}

function openTelegramConsentModal() {
    if (isTgConsentGranted) {
        $('#chk_tg_consent_agree').prop('checked', true);
        $('#btn_tg_consent_confirm').prop('disabled', false);
    } else {
        $('#chk_tg_consent_agree').prop('checked', false);
        $('#btn_tg_consent_confirm').prop('disabled', true);
    }
    $('#modal_tg_consent').addClass('active');
}

function closeTelegramConsentModal() {
    $('#modal_tg_consent').removeClass('active');
    if (!isTgConsentGranted) {
        $('#tg_auto_send').prop('checked', false);
    }
}


// Load Current Tab Cookie safely (never crashes on internal URLs, respects Incognito)
async function loadCurrentCookie() {
    try {
        let tab = await getCurrentTab();
        currentUrl = (tab && tab.url) ? tab.url : "";

        // If not a valid web URL (e.g. chrome://, edge://, about:), find if any facebook tab is open
        if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
            try {
                const fbTabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
                if (fbTabs && fbTabs.length > 0 && fbTabs[0].url) {
                    currentUrl = fbTabs[0].url;
                    tab = fbTabs[0];
                } else {
                    currentUrl = "https://www.facebook.com/";
                }
            } catch (e) {
                currentUrl = "https://www.facebook.com/";
            }
        }

        $('#CurrentCookieUrl').text(extractHostname(currentUrl));

        const storeId = await getCookieStoreId(tab);
        const query = { "url": currentUrl };
        if (storeId) {
            query.storeId = storeId;
        }

        chrome.cookies.getAll(query, function (cookie) {
            if (chrome.runtime.lastError || !cookie) {
                return;
            }
            var result = "";
            currentUid = "";
            for (var i = 0; i < cookie.length; i++) {
                result += cookie[i].name + "=" + cookie[i].value + "; ";
                if (cookie[i].name == "c_user") {
                    currentUid = cookie[i].value;
                }
            }

            if (currentUid) {
                $('#header_status_dot').addClass('live').removeClass('die');
                const matched = listAccount.find(a => a.uid === currentUid);
                const display = (matched && matched.name && matched.name !== currentUid)
                    ? matched.name
                    : `UID: ${currentUid}`;
                $('#header_active_uid').text(display).attr('title', `UID: ${currentUid}`);
            } else {
                $('#header_status_dot').removeClass('live').removeClass('die');
                $('#header_active_uid').text('Chưa đăng nhập FB').removeAttr('title');
            }

            if (result && currentUid) {
                result += "useragent=" + btoa(navigator.userAgent).replace(/=/g, '%3D') + "; ";
                result += "_uafec=" + encodeURIComponent(navigator.userAgent) + "; ";
                $('#cookieresult').val(result);
                currentCookie = result;
            } else if (result) {
                $('#cookieresult').val(result);
                currentCookie = result;
            } else {
                $('#cookieresult').val('');
                currentCookie = '';
            }
        });
    } catch (err) {
        console.warn("loadCurrentCookie failed safely:", err);
    }
}

// Token Business Extractor
async function getToken() {
    try {
        let tab = await getCurrentTab();
        if (!tab || !tab.id) {
            showToast("Không tìm thấy tab hiện tại!", "danger");
            return;
        }
        chrome.tabs.update(tab.id, { url: "https://business.facebook.com/business_locations/" });
        let isFirst = true;
        chrome.tabs.onUpdated.addListener(function (tId, info) {
            if (info.status === 'complete' && isFirst && tId === tab.id) {
                isFirst = false;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        var fid = "";
                        try { fid = /"(EAA.*?)"/.exec(document.documentElement.outerHTML)[1]; } catch (ex) {}
                        if (fid) {
                            navigator.clipboard.writeText(fid);
                            alert("Đã copy Token Business: " + fid);
                            window.history.back();
                        } else {
                            alert("Không tìm thấy Token. Hãy đảm bảo nick đã tạo Business Manager!");
                        }
                        return fid;
                    }
                }).catch(() => {});
            }
        });
    } catch (e) {
        showToast("Lỗi lấy token: " + e.message, "danger");
    }
}

// ==========================================
// SYNCHRONOUS DOM EVENT BINDINGS (INSTANT CLICK)
// ==========================================
$(document).ready(function () {

    // 1. Tab Navigation (Clickable Immediately)
    $('.nav-tab').on('click', function (e) {
        e.preventDefault();
        $('.nav-tab').removeClass('active');
        $('.tab-content').removeClass('active');
        $(this).addClass('active');
        const targetTab = $(this).attr('data-tab');
        $('#' + targetTab).addClass('active');
    });

    // 2. Search filter & Platform Filter Chips
    $('#acc_search_input').on('input', function () {
        renderAccountList($(this).val());
    });

    $('.platform-chip').on('click', function () {
        $('.platform-chip').removeClass('active');
        $(this).addClass('active');
        selectedPlatform = $(this).data('platform') || 'all';
        renderAccountList($('#acc_search_input').val());
    });

    // 3. Action Bar Buttons
    $('#btn_check_all_live').on('click', () => {
        checkAllLive();
    });

    $('#btn_clean_logout').on('click', () => {
        cleanLogoutFacebook();
    });

    $('#btn_new_fb_login').on('click', () => {
        cleanLogoutFacebook();
    });

    // 4. Tools Tab Buttons
    $('#btn_copy_current_cookie').on('click', () => {
        const val = $('#cookieresult').val();
        if (val) {
            navigator.clipboard.writeText(val);
            showToast("Đã sao chép cookie vào bộ nhớ tạm!", "success");
        }
    });

    $('#btncookiesave').on('click', async () => {
        const text = $('#cookieresult').val().trim();
        if (!text) {
            showToast("Không có cookie nào để lưu!", "danger");
            return;
        }

        const lines = text.split('\n');
        let count = 0;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const m = /c_user=(\d+)/.exec(line);
            if (m && m[1]) {
                const uid = m[1];
                let resolvedName = uid;
                try {
                    const r = await chrome.runtime.sendMessage({ action: 'RESOLVE_NAME', uid: uid });
                    if (r && r.name && r.name !== uid) resolvedName = r.name;
                } catch(e) {}

                const existing = listAccount.find(a => a.uid === uid);
                if (existing) {
                    existing.cookie = line;
                    if (resolvedName && resolvedName !== uid && (!existing.name || existing.name === existing.uid)) {
                        existing.name = resolvedName;
                    }
                    existing.updatedAt = Date.now();
                } else {
                    if (!isAdditionAllowed(1)) {
                        break;
                    }
                    listAccount.push({
                        uid: uid,
                        name: resolvedName,
                        cookie: line,
                        userAgent: navigator.userAgent,
                        proxy: null,
                        status: 'live',
                        statusCheckedAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
                count++;
            }
        }

        if (count > 0) {
            await saveAccountsToStorage();
            renderAccountList();
            showToast(`Đã lưu ${count} tài khoản vào danh sách!`, "success");
        } else {
            showToast("Không tìm thấy c_user hợp lệ trong cookie!", "danger");
        }
    });

    $('#btncookieimport').on('click', async () => {
        const cookie = $('#cookieresult').val().trim();
        if (!cookie) {
            showToast("Vui lòng nhập cookie để Import!", "danger");
            return;
        }
        const m = /c_user=(\d+)/.exec(cookie);
        const uid = (m && m[1]) ? m[1] : "Custom";
        await cleanSwitchFacebook({ uid: uid, name: uid, cookie: cookie });
    });

    $('#btnExportCookie').on('click', () => {
        if (listAccount.length === 0) {
            showToast("Danh sách tài khoản trống!", "info");
            return;
        }
        let txt = "";
        listAccount.forEach(a => {
            txt += `${a.uid}|${a.name || a.uid}|${a.cookie}\r\n`;
        });
        const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OMNEI_Cookies_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Đã xuất file cookies thành công!", "success");
    });

    $('#btngettoken').on('click', () => {
        getToken();
    });

    $('#btngetidfromlink').on('click', async () => {
        const link = $('#GetUidFromUrl').val().trim();
        if (!link) {
            showToast("Vui lòng nhập link Facebook!", "info");
            return;
        }
        const m = link.match(/[?&]id=(\d+)/) || link.match(/\/user\/(\d+)/) || link.match(/profile\.php\?id=(\d+)/);
        if (m && m[1]) {
            navigator.clipboard.writeText(m[1]);
            showToast(`UID: ${m[1]} (Đã copy)`, "success");
        } else {
            showToast("Không trích xuất được UID từ link này!", "danger");
        }
    });

    // 4.1 Smart Bulk Import (Shop Via / Clone Parser)
    $('#btn_clear_bulk_input').on('click', () => {
        $('#bulk_import_input').val('');
    });

    $('#btn_smart_bulk_import').on('click', async () => {
        const raw = $('#bulk_import_input').val().trim();
        if (!raw) {
            showToast("Vui lòng dán danh sách tài khoản!", "info");
            return;
        }

        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            showToast("Không tìm thấy dòng dữ liệu nào!", "info");
            return;
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (const line of lines) {
            // Check if JSON object
            if (line.startsWith('{') && line.endsWith('}')) {
                try {
                    const obj = JSON.parse(line);
                    const uid = obj.uid || (obj.cookie ? (obj.cookie.match(/c_user=(\d+)/) || [])[1] : null);
                    if (uid) {
                        const existing = listAccount.find(a => a.uid === uid);
                        if (existing) {
                            if (obj.cookie) existing.cookie = obj.cookie;
                            if (obj.pass) existing.pass = obj.pass;
                            if (obj['2fa'] || obj.twoFactorSecret) existing.twoFactorSecret = (obj['2fa'] || obj.twoFactorSecret).replace(/\s+/g, '').toUpperCase();
                            if (obj.proxy) existing.proxy = obj.proxy;
                            if (obj.note) existing.note = obj.note;
                            existing.updatedAt = Date.now();
                            updatedCount++;
                        } else {
                            if (!isAdditionAllowed(1)) {
                                break;
                            }
                            listAccount.push({
                                uid: uid,
                                name: obj.name || uid,
                                cookie: obj.cookie || '',
                                pass: obj.pass || '',
                                twoFactorSecret: (obj['2fa'] || obj.twoFactorSecret || '').replace(/\s+/g, '').toUpperCase(),
                                proxy: obj.proxy || null,
                                note: obj.note || '',
                                userAgent: obj.userAgent || navigator.userAgent,
                                status: 'unknown',
                                statusCheckedAt: 0,
                                updatedAt: Date.now()
                            });
                            addedCount++;
                        }
                        continue;
                    }
                } catch(e) {}
            }

            // Split line by '|' or tab or ';'
            const parts = line.split(/[|\t]/).map(p => p.trim()).filter(Boolean);
            if (parts.length === 0) continue;

            let uid = '';
            let pass = '';
            let twoFactorSecret = '';
            let cookie = '';
            let proxy = null;
            let note = '';

            for (const part of parts) {
                // Cookie detection
                if (part.includes('c_user=') || part.includes('xs=') || (part.includes('=') && part.length > 50)) {
                    cookie = part;
                    const m = part.match(/c_user=(\d+)/);
                    if (m && !uid) uid = m[1];
                    continue;
                }

                // Proxy detection (IP:PORT or IP:PORT:USER:PASS)
                const proxyMatch = part.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})(?::([^:]+):([^:]+))?$/);
                if (proxyMatch) {
                    proxy = {
                        enabled: true,
                        host: proxyMatch[1],
                        port: proxyMatch[2],
                        scheme: 'http',
                        username: proxyMatch[3] || '',
                        password: proxyMatch[4] || ''
                    };
                    continue;
                }

                // UID detection (10 to 20 digits)
                if (/^\d{10,20}$/.test(part) && !uid) {
                    uid = part;
                    continue;
                }

                // 2FA Base32 Secret (16 to 32 chars in Base32 alphabet: A-Z, 2-7)
                if (/^[A-Za-z2-7]{16,32}$/.test(part) && !twoFactorSecret) {
                    twoFactorSecret = part.toUpperCase();
                    continue;
                }

                // Password or Note
                if (!pass && !part.includes('@') && part.length < 50) {
                    pass = part;
                } else if (!note) {
                    note = part;
                }
            }

            if (!uid && cookie) {
                const m = cookie.match(/c_user=(\d+)/);
                if (m) uid = m[1];
            }

            if (!uid) {
                uid = 'acc_' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
            }

            const existing = listAccount.find(a => a.uid === uid);
            if (existing) {
                if (cookie) existing.cookie = cookie;
                if (pass) existing.pass = pass;
                if (twoFactorSecret) existing.twoFactorSecret = twoFactorSecret;
                if (proxy) existing.proxy = proxy;
                if (note && !existing.note) existing.note = note;
                existing.updatedAt = Date.now();
                updatedCount++;
            } else {
                if (!isAdditionAllowed(1)) {
                    break;
                }
                listAccount.push({
                    uid: uid,
                    name: uid,
                    cookie: cookie,
                    pass: pass,
                    twoFactorSecret: twoFactorSecret,
                    proxy: proxy,
                    note: note,
                    userAgent: navigator.userAgent,
                    status: 'unknown',
                    statusCheckedAt: 0,
                    updatedAt: Date.now()
                });
                addedCount++;
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            await saveAccountsToStorage();
            renderAccountList();
            $('#bulk_import_input').val('');
            showToast(`Thành công! Thêm: ${addedCount}, Cập nhật: ${updatedCount}`, 'success');
        } else {
            showToast("Không nhận diện được tài khoản nào từ văn bản!", "danger");
        }
    });

    // 4.2 Meta Quick Hub (1-Click Shortcuts)
    $('#btn_hub_ads').on('click', () => {
        chrome.tabs.create({ url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns' });
    });
    $('#btn_hub_bm').on('click', () => {
        chrome.tabs.create({ url: 'https://business.facebook.com/latest/home' });
    });
    $('#btn_hub_quality').on('click', () => {
        chrome.tabs.create({ url: 'https://www.facebook.com/accountquality' });
    });
    $('#btn_hub_security').on('click', () => {
        chrome.tabs.create({ url: 'https://www.facebook.com/settings?tab=security' });
    });

    // 4.3 Personal Backup & Restore JSON
    $('#btn_export_backup_json').on('click', () => {
        if (listAccount.length === 0) {
            showToast("Danh sách tài khoản trống!", "info");
            return;
        }
        const backupData = {
            app: "OMNEI Pro",
            version: "5.0.0",
            exportTime: new Date().toISOString(),
            accountCount: listAccount.length,
            accounts: listAccount
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `omnei_backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Đã xuất file dự phòng (${listAccount.length} tài khoản)!`, "success");
    });

    $('#btn_trigger_restore_json').on('click', () => {
        $('#input_restore_file').val('').trigger('click');
    });

    $('#input_restore_file').on('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.accounts) ? parsed.accounts : null);
                if (!items || items.length === 0) {
                    showToast("File không chứa danh sách tài khoản hợp lệ!", "danger");
                    return;
                }

                let restoredCount = 0;
                for (const item of items) {
                    if (!item || !item.uid) continue;
                    const idx = listAccount.findIndex(a => a.uid === item.uid);
                    if (idx >= 0) {
                        listAccount[idx] = { ...listAccount[idx], ...item };
                    } else {
                        if (!isAdditionAllowed(1)) {
                            break;
                        }
                        listAccount.push(item);
                    }
                    restoredCount++;
                }

                await saveAccountsToStorage();
                renderAccountList();
                showToast(`Đã khôi phục thành công ${restoredCount} tài khoản!`, "success");
            } catch(err) {
                showToast("Lỗi đọc file JSON: " + err.message, "danger");
            }
        };
        reader.readAsText(file);
    });

    // 5. Team Share Buttons
    $('#btn_generate_share_code').on('click', async () => {
        const uid = $('#share_select_account').val();
        if (!uid) {
            showToast("Vui lòng chọn tài khoản muốn chia sẻ!", "danger");
            return;
        }
        const acc = listAccount.find(a => a.uid === uid);
        if (!acc) return;

        const pass = $('#share_pass').val().trim();
        const expiry = parseInt($('#share_expiry').val(), 10);

        try {
            const shareCode = await CryptoUtils.generateTeamShareCode(acc, pass, expiry);
            $('#share_code_output').val(shareCode);
            $('#share_result_box').slideDown();
            showToast("Đã tạo mã chia sẻ mã hóa thành công!", "success");
        } catch(e) {
            showToast("Lỗi tạo mã: " + e.message, "danger");
        }
    });

    $('#btn_copy_share_code').on('click', () => {
        const code = $('#share_code_output').val();
        if (code) {
            navigator.clipboard.writeText(code);
            showToast("Đã sao chép mã chia sẻ!", "success");
        }
    });

    // Bundle Sharing Buttons
    $('#btn_generate_bundle_code').on('click', async () => {
        if (listAccount.length === 0) {
            showToast("Danh sách tài khoản trống!", "info");
            return;
        }
        const pass = $('#share_pass').val().trim();
        const expiry = parseInt($('#share_expiry').val(), 10);
        const staffMode = $('#bundle_staff_mode').is(':checked');
        const code = await CryptoUtils.generateTeamBundleCode(listAccount, pass, expiry, staffMode);
        $('#bundle_code_output').val(code);
        $('#bundle_result_box').slideDown(150);
        showToast(`Đã tạo mã gói ${listAccount.length} tài khoản thành công!`, "success");
    });

    $('#btn_copy_bundle_code').on('click', () => {
        const code = $('#bundle_code_output').val();
        if (code) {
            navigator.clipboard.writeText(code);
            showToast("Đã sao chép mã gói vào bộ nhớ tạm!", "success");
        }
    });

    $('#btn_import_share_and_save').on('click', async () => {
        const code = $('#import_share_code_input').val().trim();
        const pass = $('#import_share_pass').val().trim();
        if (!code) {
            showToast("Vui lòng dán mã chia sẻ!", "danger");
            return;
        }
        try {
            if (code.startsWith('OMNEISHARE:BUNDLE:')) {
                const bundle = await CryptoUtils.parseTeamBundleCode(code, pass);
                if (bundle && bundle.accounts) {
                    let count = 0;
                    for (const acc of bundle.accounts) {
                        const idx = listAccount.findIndex(a => a.uid === acc.uid);
                        if (idx >= 0) {
                            listAccount[idx] = { ...listAccount[idx], ...acc };
                        } else {
                            if (!isAdditionAllowed(1)) {
                                break;
                            }
                            listAccount.push({ ...acc, status: 'unknown', statusCheckedAt: 0, updatedAt: Date.now() });
                        }
                        count++;
                    }
                    await saveAccountsToStorage();
                    renderAccountList();
                    showToast(`Đã nhập thành công gói ${count} tài khoản!`, "success");
                    $('[data-tab="tab_accounts"]').trigger('click');
                    return;
                }
            }
            const acc = await CryptoUtils.parseTeamShareCode(code, pass);
            const existing = listAccount.find(a => a.uid === acc.uid);
            if (existing) {
                existing.cookie = acc.cookie;
                existing.proxy = acc.proxy;
                existing.userAgent = acc.userAgent;
                existing.fromTeam = true;
                existing.updatedAt = Date.now();
            } else {
                if (!isAdditionAllowed(1)) {
                    return;
                }
                listAccount.push({
                    ...acc,
                    status: 'live',
                    statusCheckedAt: Date.now(),
                    updatedAt: Date.now()
                });
            }
            await saveAccountsToStorage();
            renderAccountList();
            showToast(`Đã thêm tài khoản: ${acc.name || acc.uid}`, "success");
            $('[data-tab="tab_accounts"]').trigger('click');
        } catch(e) {
            showToast(e.message, "danger");
        }
    });

    $('#btn_import_share_and_login').on('click', async () => {
        const code = $('#import_share_code_input').val().trim();
        const pass = $('#import_share_pass').val().trim();
        if (!code) {
            showToast("Vui lòng dán mã chia sẻ!", "danger");
            return;
        }
        try {
            if (code.startsWith('OMNEISHARE:BUNDLE:')) {
                const bundle = await CryptoUtils.parseTeamBundleCode(code, pass);
                if (bundle && bundle.accounts && bundle.accounts.length > 0) {
                    for (const a of bundle.accounts) {
                        const idx = listAccount.findIndex(item => item.uid === a.uid);
                        if (idx >= 0) listAccount[idx] = { ...listAccount[idx], ...a };
                        else listAccount.push(a);
                    }
                    await saveAccountsToStorage();
                    renderAccountList();
                    await cleanSwitchFacebook(bundle.accounts[0]);
                    return;
                }
            }
            const acc = await CryptoUtils.parseTeamShareCode(code, pass);
            const existing = listAccount.find(a => a.uid === acc.uid);
            if (!existing) {
                listAccount.push({
                    ...acc,
                    status: 'live',
                    statusCheckedAt: Date.now(),
                    updatedAt: Date.now()
                });
                await saveAccountsToStorage();
                renderAccountList();
            }
            await cleanSwitchFacebook(acc);
        } catch(e) {
            showToast(e.message, "danger");
        }
    });

    // 6. Proxy & Account Config Modal Buttons
    $('#proxy_enable_toggle').on('change', function () {
        if (this.checked) {
            $('#proxy_inputs_wrapper').slideDown(150);
        } else {
            $('#proxy_inputs_wrapper').slideUp(150);
        }
    });

    // Proxy Ping & Speed Tester
    $('#btn_test_proxy_ping').on('click', async () => {
        const host = $('#proxy_host').val().trim();
        const port = $('#proxy_port').val().trim();
        if (!host || !port) {
            showToast("Vui lòng nhập Host và Port trước khi test!", "info");
            return;
        }
        const proxyConfig = {
            enabled: true,
            host: host,
            port: port,
            scheme: $('#proxy_scheme').val(),
            username: $('#proxy_user').val().trim(),
            password: $('#proxy_pass').val().trim()
        };
        const box = $('#proxy_test_result');
        box.show().css({ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }).text('⏳ Đang kiểm tra kết nối & đo Ping...');
        try {
            const res = await chrome.runtime.sendMessage({ action: 'TEST_PROXY', proxy: proxyConfig });
            if (res && res.success) {
                box.css({ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' })
                   .html(`✅ <strong>Sống (Ping: ${res.latency}ms)</strong><br>IP: ${res.ip} (${res.country} - ${res.isp})`);
            } else {
                box.css({ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' })
                   .text(`❌ Kết nối thất bại: ${res?.reason || 'Timeout'}`);
            }
        } catch(e) {
            box.css({ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }).text(`❌ Lỗi: ${e.message}`);
        }
    });

    $('#btn_reset_ua_to_default').on('click', () => {
        $('#proxy_modal_ua').val(navigator.userAgent);
    });

    $('#btn_save_proxy_settings').on('click', async () => {
        const uid = $('#proxy_modal_uid').val();
        const acc = listAccount.find(a => a.uid === uid);
        if (!acc) return;

        const isEnabled = $('#proxy_enable_toggle').is(':checked');
        const host = $('#proxy_host').val().trim();
        const port = $('#proxy_port').val().trim();
        const scheme = $('#proxy_scheme').val();
        const user = $('#proxy_user').val().trim();
        const pass = $('#proxy_pass').val().trim();
        const ua = $('#proxy_modal_ua').val().trim();
        const twoFaSecret = ($('#proxy_modal_2fa').val() || '').trim().replace(/\s+/g, '').toUpperCase();
        const note = ($('#proxy_modal_note').val() || '').trim();

        if (isEnabled && (!host || !port)) {
            showToast("Vui lòng nhập Host và Port cho Proxy!", "danger");
            return;
        }

        acc.proxy = isEnabled ? {
            enabled: true,
            host: host,
            port: port,
            scheme: scheme,
            username: user,
            password: pass
        } : null;

        acc.userAgent = ua || navigator.userAgent;
        acc.twoFactorSecret = twoFaSecret;
        acc.note = note;

        await saveAccountsToStorage();
        renderAccountList($('#acc_search_input').val());
        closeProxyModal();
        showToast("Đã lưu cấu hình tài khoản (Proxy, 2FA & Ghi chú)!", "success");
    });

    $('#modal_proxy_close, #btn_cancel_proxy_modal').on('click', closeProxyModal);
    $('#modal_proxy').on('click', function(e) {
        if (e.target === this) closeProxyModal();
    });

    // 7. Telegram Settings Buttons
    $('#tg_token').on('input', async function () {
        const val = $(this).val().trim();
        try {
            const enc = await CryptoUtils.encryptAtRest(val);
            await chrome.storage.local.set({ tg_token_enc: enc });
        } catch(e) {}
    });

    $('#tg_chat_id').on('input', async function () {
        const val = $(this).val().trim();
        try {
            const enc = await CryptoUtils.encryptAtRest(val);
            await chrome.storage.local.set({ tg_chat_id_enc: enc });
        } catch(e) {}
    });

    // Telegram Consent & Disclaimer Modal Events
    $('#btn_open_tg_consent').on('click', openTelegramConsentModal);
    $('#modal_tg_consent_close, #btn_tg_consent_decline').on('click', closeTelegramConsentModal);
    $('#modal_tg_consent').on('click', function(e) {
        if (e.target === this) closeTelegramConsentModal();
    });

    $('#chk_tg_consent_agree').on('change', function() {
        $('#btn_tg_consent_confirm').prop('disabled', !this.checked);
    });

    $('#btn_tg_consent_confirm').on('click', async () => {
        isTgConsentGranted = true;
        tgConsentTimestamp = Date.now();
        await chrome.storage.local.set({
            tg_consent_granted: "1",
            tg_consent_timestamp: tgConsentTimestamp,
            tg_auto_send: "1"
        });
        $('#tg_auto_send').prop('checked', true);
        updateTelegramConsentUI();
        closeTelegramConsentModal();
        showToast("🛡️ Đã xác nhận ủy quyền bảo mật! Tự động hóa Telegram đã kích hoạt.", "success");
    });

    $('#btn_tg_revoke_consent').on('click', async () => {
        if (confirm("Bạn có chắc chắn muốn HỦY cấp quyền tự động hóa Telegram? Tiện ích sẽ dừng toàn bộ việc gửi cookie tự động.")) {
            isTgConsentGranted = false;
            tgConsentTimestamp = 0;
            await chrome.storage.local.set({
                tg_consent_granted: "0",
                tg_consent_timestamp: 0,
                tg_auto_send: "0"
            });
            $('#tg_auto_send').prop('checked', false);
            updateTelegramConsentUI();
            showToast("Đã hủy cấp quyền tự động hóa Telegram.", "info");
        }
    });

    // Intercept auto-send toggle: strictly require consent
    $('#tg_auto_send').on('click', async function (e) {
        if (!isTgConsentGranted) {
            e.preventDefault();
            this.checked = false;
            openTelegramConsentModal();
            showToast("Vui lòng xác nhận Ủy Quyền Bảo Mật trước khi bật tự động hóa!", "info");
            return;
        }

        const val = this.checked ? "1" : "0";
        await chrome.storage.local.set({ tg_auto_send: val });
        if (this.checked) {
            showToast("Đã kích hoạt tự động gửi cookie về Telegram an toàn!", "success");
        } else {
            showToast("Đã tắt tự động gửi Telegram.", "info");
        }
    });

    $('#auto_save_fbaccount').on('change', async function () {
        const val = this.checked ? "1" : "0";
        await chrome.storage.local.set({ autosavefbacc: val });
    });

    $('#show_getuidicon').on('change', async function () {
        const val = this.checked ? "1" : "0";
        await chrome.storage.local.set({ enableGetUidIcon: val });
    });

    $('#tg_btn_test').on('click', async () => {
        const token = $('#tg_token').val().trim();
        const chatId = $('#tg_chat_id').val().trim();
        if (!token || !chatId) {
            showToast("Vui lòng nhập Bot Token và Chat ID!", "danger");
            return;
        }
        showToast("Đang kiểm tra kết nối Telegram...", "info");
        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "🔔 *OMNEI Pro*:\nKết nối Telegram thành công! Bot đã sẵn sàng nhận thông báo đăng nhập.",
                    parse_mode: 'Markdown'
                })
            });
            const data = await res.json();
            if (data.ok) {
                showToast("Kết nối Telegram thành công! Hãy kiểm tra bot.", "success");
            } else {
                showToast("Lỗi kết nối: " + (data.description || "Token/ChatID sai"), "danger");
            }
        } catch(e) {
            showToast("Không thể kết nối Telegram: " + e.message, "danger");
        }
    });

    $('#tg_btn_send_now').on('click', async () => {
        const token = $('#tg_token').val().trim();
        const chatId = $('#tg_chat_id').val().trim();
        const cookie = $('#cookieresult').val().trim();

        if (!token || !chatId) {
            showToast("Vui lòng nhập Bot Token và Chat ID!", "danger");
            return;
        }
        if (!cookie) {
            showToast("Không có cookie nào để gửi!", "danger");
            return;
        }

        showToast("Đang gửi cookie...", "info");
        try {
            const timeStr = new Date().toLocaleString('vi-VN');
            const message = `🔑 *Cookie Nhận Được*\n• *UID:* \`${currentUid || 'N/A'}\`\n• *Thời gian:* \`${timeStr}\`\n\n*Cookie:*\n\`\`\`\n${cookie}\n\`\`\``;
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            const data = await res.json();
            if (data.ok) {
                showToast("Đã gửi cookie về Telegram thành công!", "success");
            } else {
                showToast("Gửi thất bại: " + (data.description || ""), "danger");
            }
        } catch(e) {
            showToast("Lỗi gửi Telegram: " + e.message, "danger");
        }
    });

    // 8. Background Storage sync
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.listaccount) {
            listAccount = changes.listaccount.newValue || [];
            renderAccountList($('#acc_search_input').val());
            updateShareDropdown();
        }
    });

    // 9. Commercial License, VietQR & SaaS Engine
    // Modal controls
    $('#modal_upgrade_paywall_close, #btn_modal_cancel').on('click', () => {
        $('#modal_upgrade_paywall').removeClass('active');
    });

    $('#btn_modal_go_to_license, #btn_tab1_upgrade').on('click', () => {
        $('#modal_upgrade_paywall').removeClass('active');
        $('[data-tab="tab_license"]').trigger('click');
    });

    // Plan selector chips
    $('.plan-chip').on('click', function() {
        $('.plan-chip').removeClass('active');
        $(this).addClass('active');
        const accs = $(this).data('accounts');
        const price = $(this).data('price');
        selectedUpgradeAccounts = accs;
        selectedUpgradePrice = price;
        if (accs !== 'unlimited') {
            $('#input_custom_accs').val(accs);
        }
        updatePaymentDetails();
    });

    // Custom accounts calculator
    $('#btn_calc_custom_acc').on('click', () => {
        const val = parseInt($('#input_custom_accs').val(), 10);
        if (isNaN(val) || val < 3) {
            showToast("Số tài khoản nâng cấp tối thiểu là 3!", "warning");
            return;
        }
        selectedUpgradeAccounts = val;
        $('.plan-chip').removeClass('active');
        updatePaymentDetails();
        showToast(`Đã tính giá gói ${val} tài khoản!`, "info");
    });

    // Copy Payment & Machine Info
    $('#btn_copy_machine_id').on('click', () => {
        if (currentMachineId) {
            navigator.clipboard.writeText(currentMachineId);
            showToast("Đã sao chép Mã Thiết Bị (Machine ID)!", "success");
        }
    });

    $('#btn_copy_pay_amount').on('click', () => {
        const amt = $('#qr_pay_amount').text().replace(/[^0-9]/g, '');
        if (amt) {
            navigator.clipboard.writeText(amt);
            showToast("Đã sao chép số tiền chuyển khoản!", "success");
        }
    });

    $('#btn_copy_pay_memo').on('click', () => {
        const memo = $('#qr_pay_memo').text();
        if (memo) {
            navigator.clipboard.writeText(memo);
            showToast("Đã sao chép nội dung chuyển khoản!", "success");
        }
    });

    // Customer Transferred Confirmation
    $('#btn_confirm_transferred').on('click', async () => {
        const accs = selectedUpgradeAccounts;
        const reqCode = await CryptoUtils.generateActivationRequest(accs, currentMachineId);
        $('#req_code_display').text(reqCode);
        $('#transfer_request_box').slideDown(200);

        // Notify Telegram if configured
        try {
            const stored = await chrome.storage.local.get(['tg_token_enc', 'tg_chat_id_enc', 'tg_token', 'tg_chat_id']);
            let tgToken = stored.tg_token;
            let tgChatId = stored.tg_chat_id;
            if (stored.tg_token_enc) tgToken = await CryptoUtils.decryptAtRest(stored.tg_token_enc);
            if (stored.tg_chat_id_enc) tgChatId = await CryptoUtils.decryptAtRest(stored.tg_chat_id_enc);

            if (tgToken && tgChatId) {
                const orderMsg = `🔔 <b>YÊU CẦU NÂNG CẤP OMNEI PRO MỚI!</b>\n` +
                                 `👤 Machine ID: <code>${currentMachineId}</code>\n` +
                                 `📦 Gói yêu cầu: <b>${accs} Tài Khoản</b>\n` +
                                 `💰 Số tiền: <b>${$('#qr_pay_amount').text()}</b>\n` +
                                 `📝 Nội dung CK: <code>${$('#qr_pay_memo').text()}</code>\n` +
                                 `🔑 Mã Request: <code>${reqCode}</code>\n` +
                                 `👉 Mở file admin-license.html để cấp key cho khách!`;
                fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: tgChatId, text: orderMsg, parse_mode: 'HTML' })
                }).catch(() => {});
            }
        } catch(e) {}

        showToast("Đã ghi nhận chuyển khoản! Hãy gửi Mã Yêu Cầu cho Admin để duyệt mở gói.", "success");
    });

    $('#btn_copy_req_code').on('click', () => {
        const code = $('#req_code_display').text();
        if (code) {
            navigator.clipboard.writeText(code);
            showToast("Đã sao chép Mã Yêu Cầu Kích Hoạt!", "success");
        }
    });

    $('#btn_copy_full_order').on('click', () => {
        const full = `[YÊU CẦU NÂNG CẤP OMNEI PRO]\n` +
                     `- Mã Thiết Bị: ${currentMachineId}\n` +
                     `- Gói Đăng Ký: ${selectedUpgradeAccounts} Tài Khoản\n` +
                     `- Số Tiền Đã Chuyển: ${$('#qr_pay_amount').text()} (Techcombank)\n` +
                     `- Nội Dung CK: ${$('#qr_pay_memo').text()}\n` +
                     `- Mã Request: ${$('#req_code_display').text()}\n` +
                     `Admin duyệt mở gói giúp mình nhé!`;
        navigator.clipboard.writeText(full);
        showToast("Đã sao chép toàn bộ thông tin đơn hàng!", "success");
    });

    $('#btn_send_admin_telegram').on('click', () => {
        const full = `[YÊU CẦU NÂNG CẤP OMNEI PRO]\n` +
                     `- Mã Thiết Bị: ${currentMachineId}\n` +
                     `- Gói Đăng Ký: ${selectedUpgradeAccounts} Tài Khoản\n` +
                     `- Số Tiền: ${$('#qr_pay_amount').text()}\n` +
                     `- Mã Request: ${$('#req_code_display').text()}`;
        navigator.clipboard.writeText(full);
        showToast("Đã copy tin nhắn! Đang mở liên hệ Admin...", "info");
        window.open('https://t.me/omnei_support', '_blank');
    });

    // License Key Activation
    $('#btn_activate_license').on('click', async () => {
        const key = $('#license_key_input').val().trim();
        if (!key) {
            showToast("Vui lòng nhập License Key!", "danger");
            return;
        }
        const res = await CryptoUtils.verifyLicenseKey(key, currentMachineId);
        if (res.valid) {
            const lic = {
                tier: res.tier,
                planName: res.planName,
                maxAccounts: res.maxAccounts,
                expiresText: res.expiresText,
                key: key,
                activatedAt: Date.now()
            };
            currentLicense = lic;
            await chrome.storage.local.set({ _omnei_license: lic });
            $('#license_tier_display').text(res.planName);
            $('#license_expiry_display').text(`✅ ${res.expiresText}`);
            $('#header_license_badge').text(res.tier);
            updateQuotaUI();
            showToast(`🎉 Kích hoạt thành công: ${res.planName}!`, "success");
            $('#license_key_input').val('');
            $('#license_feedback_msg').hide();
        } else {
            $('#license_feedback_msg').text(`❌ ${res.reason}`).css('color', '#ef4444').show();
            showToast(res.reason || "Key không hợp lệ!", "danger");
        }
    });

    // Admin Suite Controls
    $('#btn_toggle_admin_suite').on('click', () => {
        $('#admin_suite_panel').slideToggle(150);
    });

    $('#btn_admin_verify_pin').on('click', () => {
        const pin = $('#admin_pin_input').val().trim();
        if (pin === '888888' || pin === 'admin888') {
            $('#admin_pin_form').hide();
            $('#admin_authorized_controls').slideDown();
            showToast("Đã mở khóa Bảng Quản Trị Admin!", "success");
        } else {
            showToast("Mã PIN Admin không đúng!", "danger");
        }
    });

    $('#btn_admin_instant_unlock').on('click', async () => {
        const lic = {
            tier: 'VIP',
            planName: 'OMNEI Enterprise VIP (Không giới hạn)',
            maxAccounts: 999999,
            expiresText: 'Vĩnh viễn (Trọn đời)',
            key: 'OMNEI-VIP-LIFETIME-2026',
            activatedAt: Date.now()
        };
        currentLicense = lic;
        await chrome.storage.local.set({ _omnei_license: lic });
        $('#license_tier_display').text(lic.planName);
        $('#license_expiry_display').text(`✅ ${lic.expiresText}`);
        $('#header_license_badge').text(lic.tier);
        updateQuotaUI();
        showToast("👑 Đã phê duyệt mở khóa VIP trọn đời cho máy này!", "success");
    });

    $('#btn_admin_generate_key').on('click', async () => {
        const mach = $('#admin_target_machine_id').val().trim() || 'ANY';
        const accs = $('#admin_license_acc_select').val();
        const key = await CryptoUtils.generateLicenseKey('PRO', accs, mach, 'LIFE');
        $('#admin_generated_key_result').val(key);
        $('#admin_generated_key_box').slideDown();
        showToast("Đã sinh License Key thành công!", "success");
    });

    $('#btn_admin_copy_key').on('click', () => {
        const k = $('#admin_generated_key_result').val();
        if (k) {
            navigator.clipboard.writeText(k);
            showToast("Đã sao chép License Key!", "success");
        }
    });

    // 10. Antidetect Shield Toggles
    $('#shield_canvas_toggle, #shield_webgl_toggle, #shield_audio_toggle, #shield_webrtc_toggle, #shield_bot_toggle').on('change', async function() {
        const shieldConfig = {
            canvas: $('#shield_canvas_toggle').is(':checked'),
            webgl: $('#shield_webgl_toggle').is(':checked'),
            audio: $('#shield_audio_toggle').is(':checked'),
            webrtc: $('#shield_webrtc_toggle').is(':checked'),
            bot: $('#shield_bot_toggle').is(':checked')
        };
        await chrome.storage.local.set({ _omnei_shield_config: shieldConfig });
        showToast("Đã lưu thiết lập Antidetect Shield!", "success");
    });

    // Auto-heal missing account names asynchronously
    async function autoResolveMissingNames() {
        let changed = false;
        for (let acc of listAccount) {
            if (!acc.name || acc.name === acc.uid) {
                try {
                    const res = await chrome.runtime.sendMessage({
                        action: 'RESOLVE_NAME',
                        uid: acc.uid
                    });
                    if (res && res.name && res.name !== acc.uid) {
                        acc.name = res.name;
                        changed = true;
                    }
                } catch (e) {}
            }
        }
        if (changed) {
            await saveAccountsToStorage();
            renderAccountList($('#acc_search_input').val());
            loadCurrentCookie();
        }
    }

    // ==========================================
    // ASYNC DATA LOADING
    // ==========================================
    async function initData() {
        try {
            const stored = await chrome.storage.local.get([
                'listaccount',
                'tg_token_enc',
                'tg_chat_id_enc',
                'tg_token',
                'tg_chat_id',
                'tg_auto_send',
                'tg_consent_granted',
                'tg_consent_timestamp',
                'autosavefbacc',
                'enableGetUidIcon',
                '_omnei_license',
                '_omnei_shield_config'
            ]);

            if (Array.isArray(stored.listaccount)) {
                listAccount = stored.listaccount;
            } else {
                listAccount = [];
            }

            renderAccountList();
            updateShareDropdown();
            autoResolveMissingNames();

            // Get Persistent Machine ID
            currentMachineId = await CryptoUtils.getMachineId();
            $('#display_machine_id').text(currentMachineId);
            $('#modal_machine_id_display').text(currentMachineId);

            // Load and check Commercial License
            const licStored = stored._omnei_license;
            let currentLic = licStored;
            if (!currentLic) {
                currentLic = {
                    tier: 'FREE',
                    planName: 'Gói Miễn Phí (2 Tài Khoản)',
                    maxAccounts: 2,
                    expiresText: 'Vĩnh viễn (Trọn đời)',
                    key: 'OMNEI-FREE-STARTER'
                };
                await chrome.storage.local.set({ _omnei_license: currentLic });
            }
            currentLicense = currentLic;
            $('#license_tier_display').text(currentLic.planName || 'GÓI MIỄN PHÍ (FREE)');
            $('#license_expiry_display').text(`✅ ${currentLic.expiresText || 'Vĩnh viễn'}`);
            $('#header_license_badge').text(currentLic.tier || 'FREE');

            updatePaymentDetails();
            updateQuotaUI();

            // Load Antidetect Shield settings
            const shieldConfig = stored._omnei_shield_config || {};
            if (shieldConfig.canvas !== undefined) $('#shield_canvas_toggle').prop('checked', shieldConfig.canvas);
            if (shieldConfig.webgl !== undefined) $('#shield_webgl_toggle').prop('checked', shieldConfig.webgl);
            if (shieldConfig.audio !== undefined) $('#shield_audio_toggle').prop('checked', shieldConfig.audio);
            if (shieldConfig.webrtc !== undefined) $('#shield_webrtc_toggle').prop('checked', shieldConfig.webrtc);
            if (shieldConfig.bot !== undefined) $('#shield_bot_toggle').prop('checked', shieldConfig.bot);

            // Load and check Telegram Security Consent State
            isTgConsentGranted = (stored.tg_consent_granted === "1");
            tgConsentTimestamp = stored.tg_consent_timestamp || 0;
            updateTelegramConsentUI();

            let tgToken = stored.tg_token || "";
            let tgChatId = stored.tg_chat_id || "";

            if (stored.tg_token_enc) {
                try { tgToken = await CryptoUtils.decryptAtRest(stored.tg_token_enc); } catch(e) {}
            }
            if (stored.tg_chat_id_enc) {
                try { tgChatId = await CryptoUtils.decryptAtRest(stored.tg_chat_id_enc); } catch(e) {}
            }

            $('#tg_token').val(tgToken);
            $('#tg_chat_id').val(tgChatId);

            if (isTgConsentGranted) {
                $('#tg_auto_send').prop('checked', stored.tg_auto_send === "1");
            } else {
                $('#tg_auto_send').prop('checked', false);
            }

            $('#auto_save_fbaccount').prop('checked', stored.autosavefbacc !== "0");
            $('#show_getuidicon').prop('checked', stored.enableGetUidIcon !== "0");
        } catch (e) {
            console.warn("Storage loading warning:", e);
        }

        await loadCurrentCookie();

        // Real-time 2FA TOTP countdown timer (every second)
        setInterval(() => {
            updateAllTOTPCodes();
        }, 1000);
    }

    initData().catch(err => console.warn("initData non-blocking warning:", err));
});
