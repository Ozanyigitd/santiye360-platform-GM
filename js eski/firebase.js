// ============================================================================
// ŞANTİYE360 — FIREBASE İSTEK, TOKEN YENİLEME VE SENKRON MOTORU (js/firebase.js)
// ============================================================================
const nativeFetch = window.fetch.bind(window);

window.fetch = function (url, options) {
  if (typeof url === 'string' && url.indexOf('firebaseio.com') !== -1) {
    options = options || {};
    const token = localStorage.getItem('s360_fb_id_token');
    if (token && url.indexOf('auth=') === -1) {
      const sepToken = url.indexOf('?') === -1 ? '?' : '&';
      url = url + sepToken + 'auth=' + encodeURIComponent(token);
    }
    if (!options.method || options.method.toUpperCase() === 'GET') {
      options.cache = 'no-store';
      const sep = url.indexOf('?') === -1 ? '?' : '&';
      url = url + sep + '_t=' + Date.now();
    }
  }
  return nativeFetch(url, options);
};

// Doğrulamalı JSON İstek Yardımcısı (guvenlik.js içerisinden taşındı)
window.fbJsonRequest = async function (path, options) {
  options = options || {};
  const url = FB_URL + path;
  const res = await window.fetch(url, options);
  const data = await res.json();
  if (!res.ok || (data && data.error)) {
    throw new Error((data && data.error) ? data.error : ('Sunucu hatası: ' + res.status));
  }
  return data;
};

// Otomatik Firebase Auth Token Yenileme (45 dakikada bir)
window.refreshFirebaseIdToken = async function () {
  const apiKey = FIREBASE_WEB_API_KEY || localStorage.getItem('s360_fb_api_key');
  const refreshToken = localStorage.getItem('s360_fb_refresh_token');
  if (!apiKey || !refreshToken) return;
  try {
    const res = await nativeFetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    });
    const data = await res.json();
    if (data && data.id_token) {
      localStorage.setItem('s360_fb_id_token', data.id_token);
      if (data.refresh_token) localStorage.setItem('s360_fb_refresh_token', data.refresh_token);
    }
  } catch (e) {}
};

setInterval(window.refreshFirebaseIdToken, 45 * 60 * 1000);

// Arka Plan Canlı Senkronizasyon (guvenlik.js'deki son mesaj key takibiyle birleştirildi)
let sonGorulenOdaMesajKey = null;
let lastPendingCount = 0;

window.runBackgroundRealtimeSync = async function () {
  if (document.hidden || !currentAccount) return;

  try {
    if (typeof loadCloudPosts === 'function') loadCloudPosts();

    if (activeRoomId) {
      const metaRes = await window.fetch(FB_URL + '/santiye360_odalar_meta/' + activeRoomId + '.json');
      const meta = await metaRes.json();
      if (meta && !meta.error) {
        activeRoomMeta = meta;
        const myKey = getMyUserKey();
        if (meta.adminKey === myKey) {
          renderRoomAdminPanel(meta);
          const pCount = meta.pending ? Object.keys(meta.pending).length : 0;
          if (pCount > lastPendingCount) {
            window.showToast('Yeni Katılım İsteği', '#' + activeRoomId + ' odası için onay bekleyen üye var.');
          }
          lastPendingCount = pCount;
        }
      }

      await loadRoomCloudMessages();
      const keys = Object.keys(window.roomMessagesCache || {});
      if (keys.length > 0) {
        const newestKey = keys[keys.length - 1];
        if (sonGorulenOdaMesajKey && newestKey !== sonGorulenOdaMesajKey) {
          const lastMsg = window.roomMessagesCache[newestKey];
          if (lastMsg && !isMe(lastMsg.authorKey || lastMsg.author)) {
            window.showToast('#' + activeRoomId + ' · ' + lastMsg.author, lastMsg.text);
          }
        }
        sonGorulenOdaMesajKey = newestKey;
      }
    }

    const pendingCode = localStorage.getItem('s360_pending_room');
    if (pendingCode && pendingCode !== activeRoomId) {
      const pRes = await window.fetch(FB_URL + '/santiye360_odalar_meta/' + pendingCode + '/members/' + getMyUserKey() + '.json');
      const memberRecord = await pRes.json();
      if (memberRecord && !memberRecord.error) {
        localStorage.removeItem('s360_pending_room');
        document.getElementById('roomStatusBanner').classList.add('hidden');
        window.showToast('Katılım Onaylandı!', '#' + pendingCode + ' şantiye odasına erişiminiz açıldı.');
        openVerifiedSiteRoom(pendingCode);
      }
    }

    if (window.seciliDmUserKey && typeof window.dmMesajlariCek === 'function') {
      window.dmMesajlariCek();
    }
  } catch (e) {}
};