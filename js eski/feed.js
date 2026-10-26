// ============================================================================
// ŞANTİYE360 — PORTFÖY VE İMAR AKIŞI (js/feed.js)
// ============================================================================
let cachedCloudPosts = [];

window.previewMainPostPhoto = function (input) {
  if (!input.files || !input.files[0]) return;
  document.getElementById('postPhotoNameLabel').textContent = input.files[0].name.substring(0, 16);
  if (typeof compressImageFile === 'function') {
    compressImageFile(input.files[0], 800, function (base64) {
      pendingPostPhotoBase64 = base64;
      document.getElementById('postPhotoPreviewImg').src = base64;
      document.getElementById('postPhotoPreviewWrap').classList.remove('hidden');
    });
  }
};

window.loadCloudPosts = async function () {
  try {
    const data = await fbJsonRequest('/santiye360_akis.json?orderBy="$key"&limitToLast=30');
    if (!data || data.error) {
      cachedCloudPosts = [];
      window.postsMapCache = {};
    } else {
      window.postsMapCache = data;
      cachedCloudPosts = Object.entries(data).reverse().slice(0, 30).map(function (entry) {
        const fbKey = entry[0];
        const item = entry[1];
        return {
          fbKey: fbKey,
          id: item.id || fbKey,
          city: item.city || item.konum || 'Ankara',
          loc: item.loc || item.konum || 'Genel Saha',
          type: item.type || item.kategori || 'Portföy & Saha',
          m2: item.m2 || null,
          emsal: item.emsal || null,
          price: item.price || null,
          author: item.author || item.yazar || 'Üye',
          authorKey: item.authorKey || cleanKey(item.author || 'uye'),
          roleTitle: item.roleTitle || 'Üye',
          avatar: item.avatar || null,
          cert: item.cert || item.yetkiKodu || 'BELİRTİLMEDİ',
          createdAt: item.createdAt || item.time || item.tarih || '',
          likedBy: item.likedBy || {},
          content: item.content || item.metin || '',
          foto: item.foto || null
        };
      });
    }
    renderFeed();
  } catch (e) {}
};

window.addPost = async function () {
  const city = document.getElementById('postCity').value;
  const loc = document.getElementById('postLocation').value.trim() || 'Merkez Parsel';
  const type = document.getElementById('postType').value;
  const m2 = parseFloat(document.getElementById('postM2').value) || null;
  const emsal = document.getElementById('postEmsal').value.trim() || null;
  const price = parseFloat(document.getElementById('postPrice').value) || null;
  const content = document.getElementById('postContent').value.trim();
  if (!content && !pendingPostPhotoBase64) return;

  const newPost = {
    id: Date.now(),
    city: city,
    loc: loc,
    type: type,
    m2: m2,
    emsal: emsal,
    price: price,
    author: currentAccount ? currentAccount.name : 'Üye',
    authorKey: getMyUserKey(),
    roleTitle: currentAccount ? currentAccount.roleTitle : 'Gayrimenkul Uzmanı',
    avatar: currentAccount ? currentAccount.avatar : null,
    cert: currentAccount ? currentAccount.code : 'BELİRTİLMEDİ',
    createdAt: new Date().toISOString(),
    likedBy: {},
    content: content,
    foto: pendingPostPhotoBase64 || null
  };

  try {
    await fbJsonRequest('/santiye360_akis.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPost)
    });

    document.getElementById('postContent').value = '';
    document.getElementById('postLocation').value = '';
    document.getElementById('postM2').value = '';
    document.getElementById('postEmsal').value = '';
    document.getElementById('postPrice').value = '';
    pendingPostPhotoBase64 = null;
    document.getElementById('postPhotoPreviewWrap').classList.add('hidden');
    document.getElementById('composerBox').classList.add('hidden');
    loadCloudPosts();
  } catch (e) {}
};

window.submitBottomQuickBar = async function () {
  const input = document.getElementById('bottomQuickInput');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';

  const newPost = {
    id: Date.now(),
    city: activeCityFilter === 'ALL' ? (currentAccount?.city || 'Ankara') : activeCityFilter,
    loc: 'Saha & Portföy Notu',
    type: text.toLowerCase().includes('imar') ? 'İmar Planı Notu' : 'Portföy & Talep',
    author: currentAccount ? currentAccount.name : 'Üye',
    authorKey: getMyUserKey(),
    roleTitle: currentAccount ? currentAccount.roleTitle : 'Proje Geliştirici',
    avatar: currentAccount ? currentAccount.avatar : null,
    cert: currentAccount ? currentAccount.code : 'BELİRTİLMEDİ',
    createdAt: new Date().toISOString(),
    likedBy: {},
    content: text
  };

  try {
    await fbJsonRequest('/santiye360_akis.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPost)
    });
    loadCloudPosts();
  } catch (e) {}
};

window.toggleCloudPostLike = async function (fbKey) {
  if (!currentAccount) return;
  const myKey = getMyUserKey();
  const post = window.postsMapCache[fbKey];
  const alreadyLiked = post && post.likedBy && post.likedBy[myKey];
  try {
    if (alreadyLiked) {
      await fbJsonRequest('/santiye360_akis/' + fbKey + '/likedBy/' + myKey + '.json', { method: 'DELETE' });
    } else {
      await fbJsonRequest('/santiye360_akis/' + fbKey + '/likedBy/' + myKey + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(true)
      });
    }
    loadCloudPosts();
  } catch (e) {}
};

window.editCloudPost = async function (fbKey) {
  const post = window.postsMapCache[fbKey];
  if (!post) return;
  const yeni = prompt('İlan / rapor metnini düzenleyin:', post.content || '');
  if (yeni === null || !yeni.trim()) return;
  try {
    await fbJsonRequest('/santiye360_akis/' + fbKey + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: yeni.trim() })
    });
    loadCloudPosts();
  } catch (e) {}
};

window.deleteCloudPost = async function (fbKey) {
  if (!confirm('Bu paylaşımı silmek istediğinize emin misiniz?')) return;
  try {
    await fbJsonRequest('/santiye360_akis/' + fbKey + '.json', { method: 'DELETE' });
    loadCloudPosts();
  } catch (e) {}
};

window.renderFeed = function () {
  const container = document.getElementById('feedContainer');
  if (!container) return;
  followedUsers = followedUsers.filter(function (u) { return !isMe(u); });
  const badge = document.getElementById('followingCountBadge');
  if (badge) badge.textContent = followedUsers.length;

  const filtered = cachedCloudPosts.filter(function (p) {
    const matchFollow = feedMode !== 'FOLLOWING' || followedUsers.includes(p.authorKey);
    const matchImar = feedMode !== 'IMAR' || (p.type && p.type.toLowerCase().includes('imar')) || (p.content && p.content.toLowerCase().includes('imar'));
    const matchCity = activeCityFilter === 'ALL' || (p.city && p.city.includes(activeCityFilter));
    return matchFollow && matchImar && matchCity;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="ds-card p-8 text-center text-xs text-[#A6B0BF]">Seçilen filtrede kayıt bulunamadı.</div>';
    return;
  }

  const myKey = getMyUserKey();

  container.innerHTML = filtered.map(function (p) {
    const mine = isMe(p.authorKey) || isMe(p.author);
    const isFollowing = followedUsers.includes(p.authorKey);
    const initials = p.author.split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    const trust = getUserTrustSummary(p.authorKey);
    const likeCount = p.likedBy ? Object.keys(p.likedBy).length : 0;
    const iLiked = p.likedBy && p.likedBy[myKey];

    const officiallyVerified = typeof isUserOfficiallyVerified === 'function' ? isUserOfficiallyVerified(p.authorKey) : false;
    const certBadgeHtml = officiallyVerified
      ? '<span class="ds-badge font-mono text-[11px]">✔ ' + esc(p.cert) + '</span>'
      : '<span class="ds-badge-neutral font-mono text-[11px]" title="Kullanıcı beyanıdır">Beyan: ' + esc(p.cert) + '</span>';

    const avatarHtml = p.avatar
      ? '<img src="' + esc(p.avatar) + '" class="w-9 h-9 rounded-lg object-cover border border-[#262C36]" />'
      : '<div class="w-9 h-9 rounded-lg bg-[#1C222B] border border-[#262C36] flex items-center justify-center font-semibold text-[#19C7B1] text-xs">' + esc(initials) + '</div>';

    const actionBtnHtml = mine
      ? '<div class="flex gap-1.5">' +
          '<button data-action="edit-post" data-fbkey="' + esc(p.fbKey) + '" class="ds-btn-secondary py-1 px-2 text-xs">Düzenle</button>' +
          '<button data-action="delete-post" data-fbkey="' + esc(p.fbKey) + '" class="ds-btn-secondary py-1 px-2 text-xs text-[#F04491]">Sil</button>' +
        '</div>'
      : '<button data-action="toggle-follow" data-userkey="' + esc(p.authorKey) + '" class="ds-btn-secondary py-1 px-2.5 text-xs">' + (isFollowing ? 'Takipte' : 'Takip Et') + '</button>';

    let structuredMetaHtml = '';
    if (p.m2 || p.emsal || p.price) {
      structuredMetaHtml = '<div class="flex flex-wrap gap-2 pt-1">' +
        (p.m2 ? '<span class="ds-badge-neutral font-mono">' + esc(p.m2) + ' m²</span>' : '') +
        (p.emsal ? '<span class="ds-badge-neutral font-mono">Emsal: ' + esc(p.emsal) + '</span>' : '') +
        (p.price ? '<span class="ds-badge font-mono">' + Number(p.price).toLocaleString('tr-TR') + ' ₺</span>' : '') +
      '</div>';
    }

    const textHtml = p.content ? '<p class="text-[13px] text-[#F3F5F7] leading-relaxed">' + esc(p.content) + '</p>' : '';
    const photoHtml = p.foto ? '<div><img src="' + esc(p.foto) + '" class="rounded-lg max-h-80 object-contain border border-[#262C36] bg-[#101318]" /></div>' : '';

    return '<article class="ds-card p-4 space-y-3 hover:border-[#384150] transition">' +
      '<div class="flex items-start justify-between gap-3">' +
        '<div data-action="open-profile" data-userkey="' + esc(p.authorKey) + '" class="flex items-center gap-3 cursor-pointer">' +
          avatarHtml +
          '<div>' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              '<span class="font-semibold text-xs text-white hover:text-[#19C7B1] transition">' + esc(p.author) + '</span>' +
              certBadgeHtml +
              (trust.count > 0 ? '<span class="text-xs font-mono text-amber-400">★ ' + esc(trust.avg) + '</span>' : '') +
            '</div>' +
            '<div class="text-xs text-[#A6B0BF]">' + esc(p.roleTitle) + ' · <span class="text-white">' + esc(p.city) + ', ' + esc(p.loc) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<span class="text-xs text-[#8E98A8] font-mono">' + esc(formatIsoTime(p.createdAt)) + '</span>' +
          actionBtnHtml +
        '</div>' +
      '</div>' +
      structuredMetaHtml +
      textHtml +
      photoHtml +
      '<div class="flex items-center justify-between pt-2 border-t border-[#262C36] text-xs text-[#A6B0BF]">' +
        '<div class="flex items-center gap-4">' +
          '<button data-action="like-post" data-fbkey="' + esc(p.fbKey) + '" class="hover:text-[#19C7B1] transition ' + (iLiked ? 'text-[#19C7B1] font-semibold' : '') + '">' +
            '<i class="fa-solid fa-thumbs-up mr-1"></i> Onayla (' + likeCount + ')' +
          '</button>' +
          '<span class="text-xs font-medium text-[#8E98A8]">' + esc(p.type) + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-4">' +
          '<button data-action="share-post" data-fbkey="' + esc(p.fbKey) + '" class="hover:text-white transition">Şantiye Odasına İlet</button>' +
          '<button data-action="open-profile" data-userkey="' + esc(p.authorKey) + '" class="hover:text-white transition">Profil & Güvenirlik</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }).join('');
};

window.openNewPostModal = function () {
  activateMainView('meydan', document.getElementById('iconBtnMeydan'));
  document.getElementById('composerBox').classList.toggle('hidden');
};

window.setStreamFilter = function (m) {
  feedMode = m;
  ['filterBtnNewest', 'filterBtnImar', 'filterBtnFollowing'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.className = 'px-3 py-1.5 rounded-md text-xs font-medium text-[#A6B0BF] hover:text-white';
  });
  const activeId = m === 'ALL' ? 'filterBtnNewest' : (m === 'IMAR' ? 'filterBtnImar' : 'filterBtnFollowing');
  const activeEl = document.getElementById(activeId);
  if (activeEl) activeEl.className = 'px-3 py-1.5 rounded-md text-xs font-medium bg-[#1C222B] text-white border border-[#262C36]';
  renderFeed();
};

window.filterByCity = function (c) {
  activeCityFilter = c;
  renderFeed();
};

window.sharePostByKeyToRoom = function (fbKey) {
  if (!activeRoomId) return alert('Önce bir şantiye odasına katılmalısınız.');
  const post = window.postsMapCache[fbKey];
  if (!post) return;
  activateMainView('santiye-lobi', document.getElementById('navBtnRooms'));
  document.getElementById('chatInput').value = post.author + ' (' + post.loc + ') kaydı inceleme için odaya iletildi.';
};