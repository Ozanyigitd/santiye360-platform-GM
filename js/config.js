// ============================================================================
// ŞANTİYE360 — SABİTLER, GLOBAL DURUM, YARDIMCILAR VE NAVİGASYON (js/config.js)
// ============================================================================
const FB_URL = 'https://menkul-a0b5d-default-rtdb.firebaseio.com';
const FIREBASE_WEB_API_KEY = ''; // İsteğe bağlı Firebase Auth Web API Key (AIzaSy...)
localStorage.setItem('s360_firebase_url', FB_URL);

// Global Uygulama Durumu (State)
let currentAccount = JSON.parse(localStorage.getItem('s360_verified_session')) || null;
if (currentAccount) {
  delete currentAccount.sifre;
  delete currentAccount.passwordHash;
  localStorage.setItem('s360_verified_session', JSON.stringify(currentAccount));
}

let directoryProfiles = {};
let verifiedBadgesMap = {};
let userRatingsMap = {};
let followedUsers = JSON.parse(localStorage.getItem('s360_following')) || [];
let feedMode = 'ALL';
let activeCityFilter = 'ALL';
let currentModalProfileKey = '';
let liveUsdRate = 34.90;
let pendingPostPhotoBase64 = null;

let activeRoomId = localStorage.getItem('s360_active_room_code') || null;
let activeRoomMeta = null;
window.roomMessagesCache = {};
window.postsMapCache = {};
window.dmMessagesCache = {};
window.seciliDmUserKey = '';
window.seciliDaireNo = 1;
window.aktifCepheFiltre = 'ALL';
window.gmMap = null;
window.uyduModuAktif = false;

// Güvenli Metin Kaçışlama (XSS Koruması)
window.esc = function (str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Büyük/küçük harf duyarlı UID temizleyici
window.cleanKey = function (str) {
  return String(str || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
};

window.emailLookupKey = function (email) {
  return String(email || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
};

window.generateOpaqueUid = function () {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(20);
  window.crypto.getRandomValues(arr);
  let out = 'usr_';
  for (let i = 0; i < 20; i++) out += chars[arr[i] % chars.length];
  return out;
};

window.generateSecureRoomCode = function () {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const arr = new Uint8Array(8);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let part1 = '', part2 = '';
  for (let i = 0; i < 4; i++) part1 += chars[arr[i] % chars.length];
  for (let i = 4; i < 8; i++) part2 += chars[arr[i] % chars.length];
  return 'GM-' + part1 + '-' + part2;
};

window.formatIsoTime = function (isoOrStr) {
  if (!isoOrStr) return '';
  if (String(isoOrStr).indexOf('T') !== -1) {
    const d = new Date(isoOrStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return isoOrStr;
};

window.roomStorageKey = function (prefix) {
  const code = (typeof activeRoomId !== 'undefined' && activeRoomId) ? activeRoomId : 'GENEL';
  return prefix + '_' + code;
};

window.toggleMobileSidebar = function (show) {
  const sb = document.getElementById('appSidebar');
  const bd = document.getElementById('mobileSidebarBackdrop');
  if (!sb || !bd) return;
  if (show) {
    sb.classList.remove('-translate-x-full');
    bd.classList.remove('hidden');
  } else {
    sb.classList.add('-translate-x-full');
    bd.classList.add('hidden');
  }
};

window.showToast = function (title, message) {
  const box = document.getElementById('liveToastContainer');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'ds-card p-3.5 border-l-4 border-[#19C7B1] shadow-2xl max-w-xs pointer-events-auto';
  const tEl = document.createElement('div');
  tEl.className = 'text-xs font-semibold text-[#19C7B1]';
  tEl.textContent = title;
  const mEl = document.createElement('div');
  mEl.className = 'text-xs text-white mt-0.5 truncate';
  mEl.textContent = message;
  div.appendChild(tEl);
  div.appendChild(mEl);
  box.appendChild(div);
  setTimeout(function () { div.remove(); }, 4200);
};

const viewTitles = {
  'tab-network': ['Portföy ve İmar Akışı', 'Saha raporları ve gayrimenkul talepleri'],
  'tab-santiye-lobi': ['Şantiye Çalışma Odaları', 'Yönetici onaylı proje kanalları ve saha görev yönetimi'],
  'tab-ozel-mesaj-dm': ['Doğrudan Mesajlar (DM)', 'Uzman arama, güvenirlik puanı görüntüleme, mesaj düzenleme ve silme'],
  'tab-canli-harita': ['Harita & Parsel CBS', 'Uydu görünümü, renkli raptiye kategorileri ve parsel yönetimi'],
  'tab-kat-maketi': ['Bağımsız Bölüm Matrisi', 'Özelleştirilebilir kat sayısı, daire sayısı, ön/arka/yan cepheler ve bahçe planı'],
  'tab-pafta-pin': ['Pafta & Proje Denetimi', 'Mimari plan ve saha görselleri üzerinde koordinat bazlı revizyon işaretleme'],
  'tab-depo-stok': ['Depo & Envanter', 'Şantiyenize özel malzeme, ekipman ve mamul envanteri oluşturma ve stok takibi'],
  'tab-sozlesme-senet': ['Sözleşme & Vade Planı', 'Aylık faiz (vade farkı) hesaplamalı ve revize edilebilir ödeme/senet planı'],
  'tab-profilim': ['Profil ve Kurumsal Kimlik', 'Yetki belgesi beyanı, uzmanlık ve profil ayarlarınız'],
  'tab-ledger': ['Hakediş ve Ödeme Defteri', 'Özelleştirilebilir imalat kalemleri ve taşeron ödemeleri'],
  'tab-weather': ['Beton & Hava Ön Tahmin Rehberi', 'Meteorolojik risk göstergeleri ve 7 günlük saha takvimi'],
  'tab-tools': ['Emsal Fizibilite ve Şerefiye', 'Kat karşılığı paylaşım ve cephe yönelim hesaplamaları'],
  'tab-emergency': ['İSG Acil Durum Yönetimi', 'Saha güvenlik ve tahliye bildirim sistemi']
};

window.switchTab = function (tabId, btnEl) {
  document.querySelectorAll('.tab-content').forEach(function (el) { el.classList.add('hidden'); });
  const target = document.getElementById(tabId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.ds-nav-item').forEach(function (b) { b.classList.remove('active'); });
  if (btnEl && btnEl.classList && btnEl.classList.contains('ds-nav-item')) {
    btnEl.classList.add('active');
  }

  if (viewTitles[tabId]) {
    document.getElementById('workspaceHeaderTitle').textContent = viewTitles[tabId][0];
    document.getElementById('workspaceHeaderSub').textContent = viewTitles[tabId][1];
  }
};

window.activateMainView = function (view, btnEl) {
  const map = {
    'meydan': 'tab-network',
    'santiye-lobi': 'tab-santiye-lobi',
    'dm': 'tab-ozel-mesaj-dm',
    'canli-harita': 'tab-canli-harita',
    'kat-maketi': 'tab-kat-maketi',
    'pafta-pin': 'tab-pafta-pin',
    'depo-stok': 'tab-depo-stok',
    'sozlesme-senet': 'tab-sozlesme-senet',
    'profilim': 'tab-profilim',
    'ledger': 'tab-ledger',
    'weather': 'tab-weather',
    'tools': 'tab-tools',
    'emergency': 'tab-emergency'
  };
  const targetId = map[view] || view;
  window.switchTab(targetId, btnEl);
  window.toggleMobileSidebar(false);
  if (view === 'santiye-lobi' && activeRoomId && typeof window.openVerifiedSiteRoom === 'function') window.openVerifiedSiteRoom(activeRoomId);
  if (view === 'profilim' && typeof window.applyCurrentAccountUI === 'function') window.applyCurrentAccountUI();
  if (view === 'weather' && typeof window.fetchRealWeather === 'function') window.fetchRealWeather();
  if (view === 'canli-harita' && typeof window.initGmMapIfNeeded === 'function') {
    setTimeout(function () { window.initGmMapIfNeeded(); }, 150);
  }
  if (view === 'dm' && typeof window.dmKisileriListele === 'function') {
    window.dmKisileriListele();
    window.dmMesajlariCek();
  }
};

// Merkezi Olay Delegasyonu (data-action ve data-baction)
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-action]');
  if (btn) {
    const action = btn.dataset.action;
    if (action === 'open-profile') window.openProfileModalByKey(btn.dataset.userkey);
    else if (action === 'toggle-follow') window.toggleFollow(btn.dataset.userkey);
    else if (action === 'like-post') window.toggleCloudPostLike(btn.dataset.fbkey);
    else if (action === 'edit-post') window.editCloudPost(btn.dataset.fbkey);
    else if (action === 'delete-post') window.deleteCloudPost(btn.dataset.fbkey);
    else if (action === 'share-post') window.sharePostByKeyToRoom(btn.dataset.fbkey);
    else if (action === 'open-room') {
      window.openVerifiedSiteRoom(btn.dataset.code);
      window.activateMainView('santiye-lobi', document.getElementById('navBtnRooms'));
    }
    else if (action === 'approve-member') window.approveRoomRequest(btn.dataset.code, btn.dataset.userkey);
    else if (action === 'reject-member') window.rejectRoomRequest(btn.dataset.code, btn.dataset.userkey);
    else if (action === 'kick-member') window.kickRoomMember(btn.dataset.code, btn.dataset.userkey);
    else if (action === 'edit-room-msg') window.editRoomMessage(btn.dataset.msgkey);
    else if (action === 'delete-room-msg') window.deleteRoomMessage(btn.dataset.msgkey);
    else if (action === 'toggle-ledger') window.toggleLedgerPaid(Number(btn.dataset.id));
    else if (action === 'edit-ledger') window.editLedgerItem(Number(btn.dataset.id));
    else if (action === 'delete-ledger') window.deleteLedgerItem(Number(btn.dataset.id));
  }

  const bEl = e.target.closest('[data-baction]');
  if (bEl) {
    const act = bEl.dataset.baction;
    if (act === 'delete-map-pin') window.haritaRaptiyeSil(bEl.dataset.fbkey);
    else if (act === 'fly-map-pin') window.haritaUcur(Number(bEl.dataset.lat), Number(bEl.dataset.lng), 16);
    else if (act === 'select-flat') {
      window.seciliDaireNo = Number(bEl.dataset.no);
      window.maketCiz();
    }
    else if (act === 'delete-pafta-pin') window.paftaTekPinSil(Number(bEl.dataset.id));
    else if (act === 'stok-degistir') window.stokGuncelle(Number(bEl.dataset.idx), Number(bEl.dataset.delta));
    else if (act === 'stok-sil') window.stokKalemiSil(Number(bEl.dataset.idx));
    else if (act === 'revize-taksit') window.taksitRevizeEt(Number(bEl.dataset.idx));
    else if (act === 'select-dm-user') window.dmKisiSec(bEl.dataset.userkey);
    else if (act === 'edit-dm-msg') window.dmMesajDuzenle(bEl.dataset.msgkey);
    else if (act === 'delete-dm-msg') window.dmMesajSil(bEl.dataset.msgkey);
  }
});