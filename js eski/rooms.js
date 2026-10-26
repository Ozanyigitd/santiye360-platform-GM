// ============================================================================
// ŞANTİYE360 — ŞANTİYE ODALARI VE SOS İŞLEMLERİ (js/rooms.js)
// ============================================================================

window.createNewSiteRoom = async function () {
  if (!currentAccount) return;
  const title = document.getElementById('newRoomTitleInput').value.trim();
  if (!title) return alert('Lütfen şantiye veya projenin adını yazın.');

  const randomCode = generateSecureRoomCode();
  const myKey = getMyUserKey();
  const membersObj = {};
  membersObj[myKey] = { name: currentAccount.name, userKey: myKey, role: 'Admin' };

  const roomMeta = {
    code: randomCode,
    title: title,
    adminKey: myKey,
    adminName: currentAccount.name,
    createdAt: new Date().toISOString(),
    members: membersObj,
    pending: {}
  };

  await fbJsonRequest('/santiye360_odalar_meta/' + randomCode + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roomMeta)
  });

  await fbJsonRequest('/santiye360_user_rooms/' + myKey + '/' + randomCode + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: randomCode, title: title, role: 'Admin' })
  });

  document.getElementById('newRoomTitleInput').value = '';
  openVerifiedSiteRoom(randomCode);
};

window.requestJoinSiteRoom = async function (rawCode) {
  if (!currentAccount || !rawCode || !rawCode.trim()) return;
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const banner = document.getElementById('roomStatusBanner');

  try {
    const meta = await fbJsonRequest('/santiye360_odalar_meta/' + code + '.json');
    if (!meta || !meta.code) {
      banner.textContent = '#' + code + ' kodlu bir şantiye odası bulunamadı. Kodu kontrol edin.';
      banner.classList.remove('hidden');
      return;
    }

    const myKey = getMyUserKey();
    const isAdmin = meta.adminKey === myKey;
    const isMember = meta.members && meta.members[myKey];

    if (isAdmin || isMember) {
      document.getElementById('lobbyJoinCodeInput').value = '';
      openVerifiedSiteRoom(code);
      return;
    }

    await fbJsonRequest('/santiye360_odalar_meta/' + code + '/pending/' + myKey + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: myKey,
        name: currentAccount.name,
        roleTitle: currentAccount.roleTitle || 'Üye',
        time: new Date().toISOString()
      })
    });

    localStorage.setItem('s360_pending_room', code);
    document.getElementById('lobbyJoinCodeInput').value = '';
    banner.textContent = '#' + code + ' (' + meta.title + ') şantiyesi için katılım talebiniz kaydedildi. Yönetici onayladığında oda bu ekranda otomatik açılır.';
    banner.classList.remove('hidden');
  } catch (e) {}
};

window.openVerifiedSiteRoom = async function (code) {
  if (!currentAccount || !code) return;
  try {
    const meta = await fbJsonRequest('/santiye360_odalar_meta/' + code + '.json');
    if (!meta || meta.error) return;

    const myKey = getMyUserKey();
    const isAdmin = meta.adminKey === myKey;
    const isMember = meta.members && meta.members[myKey];

    if (!isAdmin && !isMember) {
      activeRoomId = null;
      localStorage.removeItem('s360_active_room_code');
      document.getElementById('activeRoomChatWrapper').classList.add('hidden');
      document.getElementById('roomAdminControlPanel').classList.add('hidden');
      document.getElementById('noRoomSelectedBox').classList.remove('hidden');
      document.getElementById('activeSiteHeaderBadge').textContent = 'Şantiye Seçilmedi';
      return;
    }

    activeRoomId = code;
    activeRoomMeta = meta;
    localStorage.setItem('s360_active_room_code', code);

    document.getElementById('noRoomSelectedBox').classList.add('hidden');
    document.getElementById('activeRoomChatWrapper').classList.remove('hidden');
    document.getElementById('roomBadgeTitle').textContent = '#' + code;
    document.getElementById('activeRoomProjectName').textContent = meta.title;
    document.getElementById('roomAdminLabel').textContent = '· Yönetici: ' + (meta.adminName || 'Admin');
    document.getElementById('activeSiteHeaderBadge').textContent = '#' + code + ' · ' + meta.title;

    const adminPanel = document.getElementById('roomAdminControlPanel');
    if (isAdmin) {
      adminPanel.classList.remove('hidden');
      renderRoomAdminPanel(meta);
    } else {
      adminPanel.classList.add('hidden');
    }

    loadRoomCloudMessages();
    if (typeof loadRoomLedgerFromCloud === 'function') loadRoomLedgerFromCloud();
    if (typeof odaVerileriniBuluttanYukle === 'function') odaVerileriniBuluttanYukle(code);
    if (typeof refreshUserSiteRooms === 'function') refreshUserSiteRooms();
  } catch (e) {}
};

window.renderRoomAdminPanel = function (meta) {
  const pendingBox = document.getElementById('adminPendingList');
  const membersBox = document.getElementById('adminMembersList');
  const badge = document.getElementById('roomAdminPendingBadge');

  const pendingList = meta.pending ? Object.values(meta.pending) : [];
  if (pendingList.length > 0) {
    badge.textContent = pendingList.length;
    badge.classList.remove('hidden');
    pendingBox.innerHTML = pendingList.map(function (p) {
      return '<div class="ds-panel p-2.5 flex items-center justify-between text-xs">' +
        '<div><div class="font-semibold text-white">' + esc(p.name) + '</div><div class="text-xs text-[#A6B0BF]">' + esc(p.roleTitle || '') + '</div></div>' +
        '<div class="flex gap-1.5">' +
          '<button data-action="approve-member" data-code="' + esc(meta.code) + '" data-userkey="' + esc(p.key) + '" class="ds-btn-primary py-1 px-2.5 text-xs">Onayla</button>' +
          '<button data-action="reject-member" data-code="' + esc(meta.code) + '" data-userkey="' + esc(p.key) + '" class="ds-btn-secondary py-1 px-2.5 text-xs text-[#F04491]">Reddet</button>' +
        '</div></div>';
    }).join('');
  } else {
    badge.classList.add('hidden');
    pendingBox.innerHTML = '<div class="text-xs text-[#8E98A8] py-2">Bekleyen katılım isteği yok.</div>';
  }

  const membersList = meta.members ? Object.entries(meta.members) : [];
  const myKey = getMyUserKey();
  membersBox.innerHTML = membersList.map(function (entry) {
    const k = entry[0];
    const m = entry[1];
    const isSelf = k === myKey;
    const actionHtml = !isSelf
      ? '<button data-action="kick-member" data-code="' + esc(meta.code) + '" data-userkey="' + esc(k) + '" class="text-xs text-[#F04491] hover:underline">Odadan Çıkar</button>'
      : '<span class="text-xs text-[#8E98A8]">Siz (Admin)</span>';

    return '<div class="ds-panel p-2.5 flex items-center justify-between text-xs">' +
      '<div><span class="font-medium text-white">' + esc(m.name) + '</span><span class="text-xs text-[#19C7B1] ml-1.5">' + esc(m.role || 'Üye') + '</span></div>' +
      actionHtml +
    '</div>';
  }).join('');
};

window.approveRoomRequest = async function (code, userKey) {
  try {
    const reqUser = await fbJsonRequest('/santiye360_odalar_meta/' + code + '/pending/' + userKey + '.json');
    if (!reqUser) return;

    await fbJsonRequest('/santiye360_odalar_meta/' + code + '/members/' + userKey + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: reqUser.name, userKey: userKey, role: 'Onaylı Üye' })
    });
    await fbJsonRequest('/santiye360_user_rooms/' + userKey + '/' + code + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, title: activeRoomMeta ? activeRoomMeta.title : code, role: 'Üye' })
    });
    await fbJsonRequest('/santiye360_odalar_meta/' + code + '/pending/' + userKey + '.json', { method: 'DELETE' });
    openVerifiedSiteRoom(code);
  } catch (e) {}
};

window.rejectRoomRequest = async function (code, userKey) {
  try {
    await fbJsonRequest('/santiye360_odalar_meta/' + code + '/pending/' + userKey + '.json', { method: 'DELETE' });
    openVerifiedSiteRoom(code);
  } catch (e) {}
};

window.kickRoomMember = async function (code, userKey) {
  if (!confirm('Bu üyeyi şantiye odasından çıkarmak istediğinize emin misiniz?')) return;
  try {
    await fbJsonRequest('/santiye360_odalar_meta/' + code + '/members/' + userKey + '.json', { method: 'DELETE' });
    await fbJsonRequest('/santiye360_user_rooms/' + userKey + '/' + code + '.json', { method: 'DELETE' });
    openVerifiedSiteRoom(code);
  } catch (e) {}
};

window.refreshUserSiteRooms = async function () {
  if (!currentAccount) return;
  const container = document.getElementById('leftMiniCardsContainer');
  if (!container) return;
  try {
    const myKey = getMyUserKey();
    const userRoomsObj = await fbJsonRequest('/santiye360_user_rooms/' + myKey + '.json');
    if (!userRoomsObj || userRoomsObj.error) {
      container.innerHTML = '<div class="text-xs text-[#8E98A8]">Henüz onaylı şantiye odanız yok.</div>';
      return;
    }
    const myRooms = Object.values(userRoomsObj);
    container.innerHTML = myRooms.map(function (r) {
      return '<div data-action="open-room" data-code="' + esc(r.code) + '" class="ds-panel p-2.5 cursor-pointer hover:border-[#19C7B1] transition flex items-center justify-between">' +
        '<div><div class="text-xs font-medium text-white">' + esc(r.title) + '</div><div class="text-xs font-mono text-[#19C7B1]">#' + esc(r.code) + '</div></div>' +
        '<span class="text-xs text-[#A6B0BF]">' + esc(r.role || 'Üye') + '</span>' +
      '</div>';
    }).join('');
  } catch (e) {}
};

window.copyRoomInviteCode = function () {
  if (!activeRoomId) return;
  navigator.clipboard.writeText(activeRoomId);
  window.showToast('Kopyalandı', 'Şantiye davet kodu (' + activeRoomId + ') panoya kopyalandı.');
};

window.loadRoomCloudMessages = async function () {
  const box = document.getElementById('chatBox');
  if (!box || !activeRoomId) return;
  try {
    const data = await fbJsonRequest('/santiye360_oda_mesajlari/' + activeRoomId + '.json?orderBy="$key"&limitToLast=50');
    if (!data || data.error) {
      box.innerHTML = '<div class="text-center text-xs text-[#8E98A8] py-16">#' + esc(activeRoomId) + ' kanalında henüz mesaj yok.</div>';
      return;
    }

    window.roomMessagesCache = data;
    const myKey = getMyUserKey();
    const isRoomAdmin = activeRoomMeta && (activeRoomMeta.adminKey === myKey);

    box.innerHTML = Object.entries(data).slice(-50).map(function (entry) {
      const msgKey = entry[0];
      const m = entry[1];
      const isMine = isMe(m.authorKey || m.author);
      const canDelete = isRoomAdmin || isMine;

      let btnsHtml = '';
      if (isMine) {
        btnsHtml += '<button data-action="edit-room-msg" data-msgkey="' + esc(msgKey) + '" class="text-xs text-[#A6B0BF] hover:text-white"><i class="fa-solid fa-pen"></i> Düzenle</button>';
      }
      if (canDelete) {
        btnsHtml += '<button data-action="delete-room-msg" data-msgkey="' + esc(msgKey) + '" class="text-xs text-[#F04491] hover:underline"><i class="fa-solid fa-trash"></i> Sil</button>';
      }
      const editedBadge = m.edited ? ' <span class="text-xs text-[#8E98A8] italic">(düzenlendi)</span>' : '';
      const sosClass = m.isSOS ? 'border-[#F04491] bg-[#F04491]/10' : '';

      return '<div class="ds-panel p-3 text-xs ' + sosClass + '">' +
        '<div class="flex justify-between items-center text-[#A6B0BF]">' +
          '<div><span class="font-semibold text-white">' + esc(m.author) + '</span><span class="text-[#19C7B1] ml-1.5 font-medium">[' + esc(m.tag) + ']</span></div>' +
          '<div class="flex items-center gap-2.5">' + btnsHtml + '<span class="font-mono text-xs">' + esc(formatIsoTime(m.createdAt || m.time)) + '</span></div>' +
        '</div>' +
        '<p class="text-[#F3F5F7] mt-1">' + esc(m.text) + editedBadge + '</p>' +
      '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
};

window.sendMessage = async function () {
  if (!activeRoomId || !currentAccount) return;
  const input = document.getElementById('chatInput');
  if (!input || !input.value.trim()) return;
  const msgObj = {
    id: Date.now(),
    author: currentAccount.name,
    authorKey: getMyUserKey(),
    tag: document.getElementById('msgTag').value.trim() || 'Saha Notu',
    createdAt: new Date().toISOString(),
    text: input.value.trim()
  };
  input.value = '';
  try {
    await fbJsonRequest('/santiye360_oda_mesajlari/' + activeRoomId + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgObj)
    });
    loadRoomCloudMessages();
  } catch (e) {}
};

window.deleteRoomMessage = async function (msgKey) {
  if (!activeRoomId) return;
  try {
    await fbJsonRequest('/santiye360_oda_mesajlari/' + activeRoomId + '/' + msgKey + '.json', { method: 'DELETE' });
    loadRoomCloudMessages();
  } catch (e) {}
};

window.editRoomMessage = async function (msgKey) {
  if (!activeRoomId) return;
  const oldObj = window.roomMessagesCache && window.roomMessagesCache[msgKey];
  const oldText = oldObj ? oldObj.text : '';
  const yeni = prompt('Mesajınızı düzenleyin:', oldText);
  if (yeni === null || !yeni.trim()) return;
  try {
    await fbJsonRequest('/santiye360_oda_mesajlari/' + activeRoomId + '/' + msgKey + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: yeni.trim(), edited: true })
    });
    loadRoomCloudMessages();
  } catch (e) {}
};

window.triggerSOS = async function (message) {
  if (!currentAccount || !activeRoomId) {
    alert('Odaya SOS mesajı bırakmak için oturum açıp bir şantiye odası seçin. Acil tehlike durumunda doğrudan 112\'yi arayın!');
    return;
  }

  const sendAlert = async function (locationText) {
    try {
      await fbJsonRequest('/santiye360_oda_mesajlari/' + activeRoomId + '.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now(),
          author: currentAccount.name,
          authorKey: getMyUserKey(),
          tag: '🚨 ACİL DURUM',
          text: message + (locationText ? ' — GPS Konum: ' + locationText : ''),
          createdAt: new Date().toISOString(),
          isSOS: true
        })
      });

      const alertBox = document.getElementById('sosAlertBox');
      document.getElementById('sosAlertTitle').textContent = '🚨 Uygulama içi SOS mesajı #' + activeRoomId + ' odasına yazıldı. Resmi yardım için mutlaka 112\'yi arayın!';
      alertBox.classList.remove('hidden');
      loadRoomCloudMessages();
    } catch (e) {}
  };

  if (!navigator.geolocation) {
    await sendAlert('');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) { sendAlert(position.coords.latitude.toFixed(5) + ', ' + position.coords.longitude.toFixed(5)); },
    function () { sendAlert(''); }
  );
};