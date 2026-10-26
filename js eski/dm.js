// ============================================================================
// ŞANTİYE360 — DOĞRUDAN MESAJLAR (DM) (js/dm.js)
// ============================================================================

window.dmKeyByUid = function (uid1, uid2) {
  return [cleanKey(uid1 || 'u1'), cleanKey(uid2 || 'u2')].sort().join('___');
};

window.dmKisileriListele = function () {
  const k = document.getElementById('dmKisiListesi');
  if (!k) return;
  const searchEl = document.getElementById('dmProfileSearchInput');
  const q = (searchEl ? searchEl.value : '').trim().toLowerCase();

  const tumProfiller = Object.values(directoryProfiles || {}).filter(function (u) {
    return !isMe(u.userKey) && !isMe(u.name);
  });
  const filtreli = tumProfiller.filter(function (u) {
    return (u.name || '').toLowerCase().includes(q) ||
      (u.roleTitle || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q);
  });

  if (!window.seciliDmUserKey && filtreli.length > 0) {
    window.seciliDmUserKey = filtreli[0].userKey;
  }

  if (filtreli.length === 0) {
    k.innerHTML = '<div class="text-xs text-[#8E98A8] py-6 text-center">Aranan kriterde başka profil bulunamadı.</div>';
    return;
  }

  k.innerHTML = filtreli.map(function (u) {
    const trust = typeof getUserTrustSummary === 'function' ? getUserTrustSummary(u.userKey) : { count: 0 };
    const active = u.userKey === window.seciliDmUserKey;
    const boxClass = active ? 'bg-[#161B22] border border-[#19C7B1]' : 'bg-[#101318] border border-[#262C36] hover:border-[#384150]';
    return '<div data-baction="select-dm-user" data-userkey="' + esc(u.userKey) + '" class="p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between ' + boxClass + '">' +
      '<div class="overflow-hidden">' +
        '<div class="text-xs font-semibold text-white truncate">' + esc(u.name) + '</div>' +
        '<div class="text-xs text-[#A6B0BF] truncate">' + esc(u.roleTitle) + ' · ' + esc(u.city) + '</div>' +
      '</div>' +
      '<span class="text-xs font-mono text-amber-400 flex-shrink-0">' + (trust.count > 0 ? ('★ ' + esc(trust.avg)) : 'Yeni') + '</span>' +
    '</div>';
  }).join('');

  if (window.seciliDmUserKey && directoryProfiles[window.seciliDmUserKey]) {
    const seciliProf = directoryProfiles[window.seciliDmUserKey];
    const b = document.getElementById('dmAktifKisiBaslik');
    const t = document.getElementById('dmAktifKisiTrust');
    if (b) b.textContent = seciliProf.name;
    if (t && typeof getUserTrustSummary === 'function') {
      const tr = getUserTrustSummary(window.seciliDmUserKey);
      t.textContent = tr.count > 0 ? ('★ ' + tr.avg + ' (' + tr.percent + ')') : 'Henüz Oylanmadı';
    }
  }
};

window.dmKisiSec = function (userKey) {
  window.seciliDmUserKey = cleanKey(userKey);
  window.dmKisileriListele();
  window.dmMesajlariCek();
};

window.dmMesajGonder = async function () {
  const inp = document.getElementById('dmMesajInput');
  if (!inp || !inp.value.trim() || !window.seciliDmUserKey) return;
  const myKey = getMyUserKey();
  const key = window.dmKeyByUid(myKey, window.seciliDmUserKey);
  const aliciProf = directoryProfiles[window.seciliDmUserKey];

  try {
    await fbJsonRequest('/santiye360_dm/' + key + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gonderen: currentAccount ? currentAccount.name : 'Kullanıcı',
        gonderenKey: myKey,
        alici: aliciProf ? aliciProf.name : window.seciliDmUserKey,
        aliciKey: window.seciliDmUserKey,
        metin: inp.value.trim(),
        createdAt: new Date().toISOString()
      })
    });
    inp.value = '';
    window.dmMesajlariCek();
  } catch (e) {}
};

window.dmMesajSil = async function (msgKey) {
  const key = window.dmKeyByUid(getMyUserKey(), window.seciliDmUserKey);
  try {
    await fbJsonRequest('/santiye360_dm/' + key + '/' + msgKey + '.json', { method: 'DELETE' });
    window.dmMesajlariCek();
  } catch (e) {}
};

window.dmMesajDuzenle = async function (msgKey) {
  const oldObj = window.dmMessagesCache && window.dmMessagesCache[msgKey];
  const eskiMetin = oldObj ? oldObj.metin : '';
  const yeni = prompt('Mesajınızı düzenleyin:', eskiMetin);
  if (yeni === null || !yeni.trim()) return;
  const key = window.dmKeyByUid(getMyUserKey(), window.seciliDmUserKey);
  try {
    await fbJsonRequest('/santiye360_dm/' + key + '/' + msgKey + '.json', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metin: yeni.trim(), edited: true })
    });
    window.dmMesajlariCek();
  } catch (e) {}
};

window.dmMesajlariCek = async function () {
  const kutu = document.getElementById('dmSohbetKutusu');
  if (!kutu || !window.seciliDmUserKey) return;
  const myKey = getMyUserKey();
  const key = window.dmKeyByUid(myKey, window.seciliDmUserKey);

  try {
    const data = await fbJsonRequest('/santiye360_dm/' + key + '.json?orderBy="$key"&limitToLast=50');
    if (!data || data.error) {
      kutu.innerHTML = '<div class="text-xs text-[#8E98A8] text-center py-16">Henüz mesaj kaydı bulunmuyor.</div>';
      return;
    }
    window.dmMessagesCache = data;
    kutu.innerHTML = Object.entries(data).slice(-50).map(function (entry) {
      const msgKey = entry[0];
      const m = entry[1];
      const benim = m.gonderenKey === myKey || isMe(m.gonderen);
      const alignClass = benim ? 'justify-end' : 'justify-start';
      const bubbleClass = benim ? 'bg-[#1C222B] text-white border border-[#19C7B1]/40' : 'bg-[#161B22] text-white border border-[#262C36]';
      const actionsHtml = benim
        ? '<span class="flex items-center gap-2">' +
            '<button data-baction="edit-dm-msg" data-msgkey="' + esc(msgKey) + '" class="hover:text-white" title="Düzenle"><i class="fa-solid fa-pen"></i></button>' +
            '<button data-baction="delete-dm-msg" data-msgkey="' + esc(msgKey) + '" class="hover:text-[#F04491]" title="Geri Al / Sil"><i class="fa-solid fa-trash"></i></button>' +
          '</span>'
        : '';
      const editedHtml = m.edited ? ' <span class="text-xs text-[#8E98A8] italic">(düzenlendi)</span>' : '';

      return '<div class="flex ' + alignClass + '">' +
        '<div class="max-w-[75%] p-3 rounded-lg text-xs ' + bubbleClass + '">' +
          '<div class="flex items-center justify-between gap-4 text-xs text-[#A6B0BF] mb-1">' +
            '<span class="font-semibold text-[#19C7B1]">' + esc(m.gonderen) + ' · ' + esc(formatIsoTime(m.createdAt || m.saat)) + '</span>' +
            actionsHtml +
          '</div>' +
          '<div>' + esc(m.metin) + editedHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    kutu.scrollTop = kutu.scrollHeight;
  } catch (e) {}
};