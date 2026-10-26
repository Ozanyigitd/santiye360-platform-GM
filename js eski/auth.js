// ============================================================================
// ŞANTİYE360 — KİMLİK DOĞRULAMA, PROFİL VE GÜVENİRLİK PUANI (js/auth.js)
// (guvenlik.js içindeki PBKDF2-100K ve Fail-Closed yamaları doğrudan gömüldü)
// ============================================================================
window.getMyUserKey = function () {
  if (!currentAccount) return '';
  return currentAccount.userKey || cleanKey(currentAccount.name);
};

window.isMe = function (keyOrName) {
  if (!currentAccount || !keyOrName) return false;
  const val = String(keyOrName).trim();
  return (
    val === getMyUserKey() ||
    cleanKey(keyOrName) === getMyUserKey() ||
    val.toLowerCase() === (currentAccount.name || '').trim().toLowerCase()
  );
};

window.switchAuthTab = function (tab) {
  document.getElementById('authErrorBox').classList.add('hidden');
  const isLogin = tab === 'login';
  document.getElementById('loginFormBox').classList.toggle('hidden', !isLogin);
  document.getElementById('registerFormBox').classList.toggle('hidden', isLogin);
  document.getElementById('authTabLogin').className = isLogin
    ? 'py-2 rounded-md bg-[#19C7B1] text-[#091311] font-semibold transition'
    : 'py-2 rounded-md text-[#A6B0BF] hover:text-white transition';
  document.getElementById('authTabRegister').className = !isLogin
    ? 'py-2 rounded-md bg-[#19C7B1] text-[#091311] font-semibold transition'
    : 'py-2 rounded-md text-[#A6B0BF] hover:text-white transition';
};

window.showAuthError = function (msg) {
  const box = document.getElementById('authErrorBox');
  box.textContent = msg;
  box.classList.remove('hidden');
};

window.hashPasswordPBKDF2Strong = async function (password, emailSalt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Tarayıcınız güvenli kriptografi (WebCrypto) desteklemiyor.');
  }
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode('santiye360_v3_salt_' + String(emailSalt).toLowerCase().trim()),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
};

window.handleRealRegister = async function () {
  const name = document.getElementById('regName').value.trim();
  const city = document.getElementById('regCity').value;
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPass').value;
  const roleTitle = document.getElementById('regRoleTitle').value;
  const cert = (document.getElementById('regCert').value.trim() || 'BELİRTİLMEDİ').toUpperCase();
  const kvkkChecked = document.getElementById('regKvkkCheck').checked;

  if (!name || name.length < 2) return showAuthError('Lütfen geçerli bir Ad Soyad veya Firma adı girin.');
  if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    return showAuthError('Lütfen geçerli bir e-posta adresi girin (Örn: ad@firma.com).');
  }
  if (!pass || pass.length < 8) {
    return showAuthError('Güvenliğiniz için şifreniz en az 8 karakter olmalıdır.');
  }
  if (!kvkkChecked) {
    return showAuthError('Kayıt olabilmek için KVKK aydınlatma metnini okuyup onay kutusunu işaretlemelisiniz.');
  }

  const btn = document.getElementById('btnRegAction');
  btn.textContent = 'Güvenlik Kontrolü Yapılıyor...';
  btn.disabled = true;

  try {
    const apiKey = FIREBASE_WEB_API_KEY || localStorage.getItem('s360_fb_api_key');
    let uid = '';

    if (apiKey) {
      const authRes = await nativeFetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass, returnSecureToken: true })
      });
      const authData = await authRes.json();
      if (authData.error) {
        throw new Error(authData.error.message === 'EMAIL_EXISTS' ? 'Bu e-posta adresi zaten kayıtlı!' : authData.error.message);
      }
      uid = authData.localId;
      localStorage.setItem('s360_fb_id_token', authData.idToken);
      localStorage.setItem('s360_fb_refresh_token', authData.refreshToken);
    } else {
      const mailKey = emailLookupKey(email);
      const existingAuth = await fbJsonRequest('/santiye360_auth/' + mailKey + '.json');
      const existingLegacy = await fbJsonRequest('/santiye360_profiles/' + mailKey + '.json');

      if ((existingAuth && existingAuth.passwordHash) || (existingLegacy && existingLegacy.name)) {
        throw new Error('Bu e-posta adresi zaten kullanımda! Giriş ekranından şifrenizle oturum açın.');
      }

      uid = generateOpaqueUid();
      const strongHash = await hashPasswordPBKDF2Strong(pass, email);

      await fbJsonRequest('/santiye360_auth/' + mailKey + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: uid,
          passwordHash: strongHash,
          algo: 'PBKDF2-SHA256-100K',
          createdAt: new Date().toISOString()
        })
      });
    }

    const initials = name.split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    const publicProfile = {
      id: uid,
      userKey: uid,
      name: name,
      initials: initials || 'ÜY',
      roleTitle: roleTitle,
      code: cert,
      city: city,
      bio: city + ' bölgesinde ' + roleTitle + ' olarak faaliyet göstermektedir.',
      avatar: null,
      cover: null,
      kvkkConsent: { accepted: true, version: 'v2.0-KVKK', timestamp: new Date().toISOString() },
      createdAt: new Date().toISOString()
    };

    await fbJsonRequest('/santiye360_profiles/' + uid + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicProfile)
    });

    completeSessionLogin(publicProfile);
  } catch (err) {
    showAuthError(err.message || 'Sunucu kayıt hatası oluştu.');
  } finally {
    btn.textContent = 'Hesabı Oluştur ve İçeri Gir';
    btn.disabled = false;
  }
};

window.handleRealLogin = async function () {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;

  if (!email || email.indexOf('@') === -1 || !pass) {
    return showAuthError('Lütfen geçerli e-posta adresinizi ve şifrenizi girin.');
  }

  const btn = document.getElementById('btnLoginAction');
  btn.textContent = 'Doğrulanıyor...';
  btn.disabled = true;

  try {
    const apiKey = FIREBASE_WEB_API_KEY || localStorage.getItem('s360_fb_api_key');
    let uid = '';

    if (apiKey) {
      const authRes = await nativeFetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass, returnSecureToken: true })
      });
      const authJson = await authRes.json();
      if (authJson.error) {
        throw new Error('E-posta veya şifre hatalı.');
      }
      uid = authJson.localId;
      localStorage.setItem('s360_fb_id_token', authJson.idToken);
      localStorage.setItem('s360_fb_refresh_token', authJson.refreshToken);
    } else {
      const mailKey = emailLookupKey(email);
      const authRecord = await fbJsonRequest('/santiye360_auth/' + mailKey + '.json');

      if (!authRecord || !authRecord.passwordHash) {
        throw new Error('Bu e-posta ile doğrulanmış hesap bulunamadı. Lütfen yeni kayıt açın.');
      }

      const inputHash = await hashPasswordPBKDF2Strong(pass, email);
      if (authRecord.passwordHash !== inputHash) {
        throw new Error('Girdiğiniz şifre hatalı.');
      }
      uid = authRecord.uid || mailKey;
    }

    const profData = await fbJsonRequest('/santiye360_profiles/' + uid + '.json');
    if (!profData || !profData.name) {
      throw new Error('Kullanıcı profil verisi bulunamadı.');
    }

    completeSessionLogin(profData);
  } catch (err) {
    showAuthError(err.message || 'Giriş yapılamadı.');
  } finally {
    btn.textContent = 'Giriş Yap ve Başla';
    btn.disabled = false;
  }
};

window.completeSessionLogin = async function (user) {
  const safeSession = {
    id: user.id || ('u_' + Date.now()),
    userKey: user.userKey || cleanKey(user.name),
    name: user.name,
    initials: user.initials || 'ÜY',
    roleTitle: user.roleTitle || 'Proje Geliştirici',
    code: user.code || 'BELİRTİLMEDİ',
    city: user.city || 'Ankara',
    bio: user.bio || '',
    avatar: user.avatar || null,
    cover: user.cover || null
  };
  currentAccount = safeSession;
  followedUsers = followedUsers.filter(function (u) { return !isMe(u); });
  localStorage.setItem('s360_following', JSON.stringify(followedUsers));
  localStorage.setItem('s360_verified_session', JSON.stringify(safeSession));
  document.getElementById('authGateModal').classList.add('hidden');
  applyCurrentAccountUI();
  loadCloudRatings();
  loadCloudUsersDirectory();
  if (typeof loadCloudPosts === 'function') loadCloudPosts();
  if (typeof refreshUserSiteRooms === 'function') refreshUserSiteRooms();
};

window.logoutCurrentSession = function () {
  if (!confirm('Oturumunuzu kapatmak istediğinize emin misiniz?')) return;
  currentAccount = null;
  activeRoomId = null;
  activeRoomMeta = null;
  localStorage.removeItem('s360_verified_session');
  localStorage.removeItem('s360_active_room_code');
  localStorage.removeItem('s360_fb_id_token');
  localStorage.removeItem('s360_fb_refresh_token');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('authGateModal').classList.remove('hidden');
};

window.loadCloudRatings = async function () {
  try {
    const [ratRes, badgeRes] = await Promise.all([
      window.fetch(FB_URL + '/santiye360_ratings.json'),
      window.fetch(FB_URL + '/santiye360_verified_badges.json')
    ]);
    const rData = await ratRes.json();
    const bData = await badgeRes.json();
    userRatingsMap = (rData && !rData.error) ? rData : {};
    verifiedBadgesMap = (bData && !bData.error) ? bData : {};
    renderSuggestedUsers();
    if (typeof renderFeed === 'function') renderFeed();
  } catch (e) {}
};

window.isUserOfficiallyVerified = function (userKey) {
  return Boolean(verifiedBadgesMap && verifiedBadgesMap[cleanKey(userKey)]);
};

window.getUserTrustSummary = function (userKeyOrName) {
  const key = cleanKey(userKeyOrName);
  const ratingsObj = userRatingsMap[key];
  if (!ratingsObj) return { avg: 'Yeni', percent: 'Değerlendirilmedi', count: 0 };
  const vals = Object.values(ratingsObj).map(function (r) {
    const s = Number(r.score);
    return Math.min(5, Math.max(1, isNaN(s) ? 5 : s));
  });
  if (vals.length === 0) return { avg: 'Yeni', percent: 'Değerlendirilmedi', count: 0 };
  const sum = vals.reduce(function (a, b) { return a + b; }, 0);
  const avg = (sum / vals.length).toFixed(1);
  const percent = '%' + Math.round((sum / (vals.length * 5)) * 100);
  return { avg: avg, percent: percent, count: vals.length };
};

window.rateUserReliability = async function (stars) {
  if (!currentAccount || !currentModalProfileKey) return;
  if (isMe(currentModalProfileKey)) return alert('Kendi profilinize puan veremezsiniz.');

  const validStars = Math.min(5, Math.max(1, Number(stars) || 5));
  const targetKey = cleanKey(currentModalProfileKey);
  const myKey = getMyUserKey();

  await window.fetch(FB_URL + '/santiye360_ratings/' + targetKey + '/' + myKey + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      score: validStars,
      raterKey: myKey,
      rater: currentAccount.name,
      date: new Date().toISOString()
    })
  });

  const fb = document.getElementById('profRatingFeedback');
  fb.textContent = validStars + '★ güvenirlik puanınız kaydedildi.';
  fb.classList.remove('hidden');
  await loadCloudRatings();
  openProfileModalByKey(currentModalProfileKey);
};

window.applyCurrentAccountUI = function () {
  if (!currentAccount) return;
  document.getElementById('topUserName').textContent = currentAccount.name;
  document.getElementById('topUserTitle').textContent = currentAccount.roleTitle || currentAccount.code;

  const headImg = document.getElementById('headerUserAvatarImg');
  const headTxt = document.getElementById('headerUserAvatarTxt');
  const profImg = document.getElementById('myProfileAvatarImg');
  const profTxt = document.getElementById('myProfileAvatarTxt');
  const covImg = document.getElementById('myProfileCoverImg');

  if (currentAccount.avatar) {
    headImg.src = currentAccount.avatar; headImg.classList.remove('hidden'); headTxt.classList.add('hidden');
    profImg.src = currentAccount.avatar; profImg.classList.remove('hidden'); profTxt.classList.add('hidden');
  } else {
    headImg.classList.add('hidden'); headTxt.classList.remove('hidden'); headTxt.textContent = currentAccount.initials || 'ÜY';
    profImg.classList.add('hidden'); profTxt.classList.remove('hidden'); profTxt.textContent = currentAccount.initials || 'ÜY';
  }

  if (currentAccount.cover) {
    covImg.src = currentAccount.cover; covImg.classList.remove('hidden');
  }

  const trust = getUserTrustSummary(getMyUserKey());
  const trustBadge = document.getElementById('myTrustScoreBadge');
  if (trustBadge) trustBadge.textContent = trust.count > 0 ? ('★ ' + trust.avg + ' (' + trust.count + ' Oy)') : 'Yeni Profil';

  document.getElementById('editProfName').value = currentAccount.name || '';
  document.getElementById('editProfTitle').value = currentAccount.roleTitle || '';
  document.getElementById('editProfCert').value = currentAccount.code || '';
  document.getElementById('editProfCity').value = currentAccount.city || '';
  document.getElementById('editProfBio').value = currentAccount.bio || '';
};

window.compressImageFile = function (file, maxWidth, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.uploadMyAvatarPhoto = function (input) {
  if (!input.files || !input.files[0] || !currentAccount) return;
  compressImageFile(input.files[0], 300, function (base64) {
    currentAccount.avatar = base64;
    applyCurrentAccountUI();
    saveMyProfileChanges();
  });
};

window.uploadMyCoverPhoto = function (input) {
  if (!input.files || !input.files[0] || !currentAccount) return;
  compressImageFile(input.files[0], 1000, function (base64) {
    currentAccount.cover = base64;
    applyCurrentAccountUI();
    saveMyProfileChanges();
  });
};

window.saveMyProfileChanges = async function () {
  if (!currentAccount) return;
  currentAccount.name = document.getElementById('editProfName').value.trim() || currentAccount.name;
  currentAccount.initials = currentAccount.name.split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  currentAccount.roleTitle = document.getElementById('editProfTitle').value.trim() || 'Proje Geliştirici';
  currentAccount.code = document.getElementById('editProfCert').value.trim().toUpperCase();
  currentAccount.city = document.getElementById('editProfCity').value.trim();
  currentAccount.bio = document.getElementById('editProfBio').value.trim();

  localStorage.setItem('s360_verified_session', JSON.stringify(currentAccount));
  applyCurrentAccountUI();

  const key = getMyUserKey();
  await window.fetch(FB_URL + '/santiye360_profiles/' + key + '.json', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentAccount)
  }).catch(function () {});

  const alertBox = document.getElementById('profileSaveAlert');
  alertBox.classList.remove('hidden');
  setTimeout(function () { alertBox.classList.add('hidden'); }, 3000);
  loadCloudUsersDirectory();
};

window.loadCloudUsersDirectory = async function () {
  try {
    const res = await window.fetch(FB_URL + '/santiye360_profiles.json');
    const data = await res.json();
    directoryProfiles = {};
    if (data && !data.error) {
      Object.entries(data).forEach(function (entry) {
        const key = entry[0];
        const u = entry[1];
        directoryProfiles[key] = {
          userKey: key,
          name: u.name || 'Üye',
          initials: u.initials || 'ÜY',
          roleTitle: u.roleTitle || 'Gayrimenkul Uzmanı',
          cert: u.code || 'BELİRTİLMEDİ',
          city: u.city || 'Türkiye',
          bio: u.bio || '',
          avatar: u.avatar || null
        };
      });
    }
    renderSuggestedUsers();
    if (typeof window.dmKisileriListele === 'function') window.dmKisileriListele();
  } catch (e) {}
};

window.renderSuggestedUsers = function () {
  const box = document.getElementById('suggestedUsersBox');
  if (!box) return;
  const list = Object.values(directoryProfiles).filter(function (u) { return !isMe(u.userKey) && !isMe(u.name); });
  if (list.length === 0) {
    box.innerHTML = '<div class="text-xs text-[#8E98A8] py-2">Sistemdeki diğer uzmanlar burada listelenir.</div>';
    return;
  }
  box.innerHTML = list.map(function (u) {
    const isF = followedUsers.includes(u.userKey);
    const trust = getUserTrustSummary(u.userKey);
    const av = u.avatar
      ? '<img src="' + esc(u.avatar) + '" class="w-8 h-8 rounded-md object-cover border border-[#262C36]" />'
      : '<div class="w-8 h-8 rounded-md bg-[#1C222B] border border-[#262C36] flex items-center justify-center font-semibold text-xs text-[#19C7B1]">' + esc(u.initials) + '</div>';
    return '<div class="p-2 rounded-lg bg-[#101318] border border-[#262C36] flex items-center justify-between gap-2">' +
      '<div data-action="open-profile" data-userkey="' + esc(u.userKey) + '" class="flex items-center gap-2.5 cursor-pointer overflow-hidden">' +
        av +
        '<div class="overflow-hidden">' +
          '<div class="font-medium text-xs text-white hover:text-[#19C7B1] truncate">' + esc(u.name) + (trust.count > 0 ? ' <span class="text-amber-400 font-mono text-xs">★' + esc(trust.avg) + '</span>' : '') + '</div>' +
          '<div class="text-xs text-[#A6B0BF] truncate">' + esc(u.roleTitle) + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" data-action="toggle-follow" data-userkey="' + esc(u.userKey) + '" class="ds-btn-secondary py-1 px-2 text-xs">' + (isF ? 'Takipte' : 'Takip Et') + '</button>' +
    '</div>';
  }).join('');
};

window.openProfileModalByKey = function (userKeyOrName) {
  if (!userKeyOrName) return;
  const key = cleanKey(userKeyOrName);
  currentModalProfileKey = key;
  const prof = directoryProfiles[key] || {
    userKey: key,
    name: userKeyOrName,
    initials: String(userKeyOrName).substring(0, 2).toUpperCase(),
    cert: 'BELİRTİLMEDİ',
    city: 'Türkiye',
    roleTitle: 'Üye',
    bio: ''
  };
  const avBox = document.getElementById('profAvatar');
  avBox.innerHTML = prof.avatar ? '<img src="' + esc(prof.avatar) + '" class="w-full h-full object-cover" />' : esc(prof.initials);
  document.getElementById('profName').textContent = prof.name;
  const verified = isUserOfficiallyVerified(key);
  document.getElementById('profCert').textContent = (verified ? '✔ Doğrulanmış: ' : 'Sicil Beyanı: ') + prof.cert + ' · ' + (prof.roleTitle || '');
  document.getElementById('profBio').textContent = prof.bio || '';
  document.getElementById('profCity').textContent = prof.city || 'Türkiye';

  const trust = getUserTrustSummary(key);
  document.getElementById('profTrust').textContent = trust.count > 0 ? ('★ ' + trust.avg + ' (' + trust.percent + ' · ' + trust.count + ' Oy)') : 'Henüz Oylanmadı';
  document.getElementById('profRatingFeedback').classList.add('hidden');

  const mine = isMe(key) || isMe(prof.name);
  document.getElementById('profActionButtons').classList.toggle('hidden', mine);
  document.getElementById('profRatingSection').classList.toggle('hidden', mine);
  document.getElementById('profFollowBtn').textContent = followedUsers.includes(key) ? 'Takipten Çık' : 'Takip Et';
  document.getElementById('profileModal').classList.remove('hidden');
};

window.openProfileModal = function (nameOrKey) { openProfileModalByKey(nameOrKey); };

window.startDmFromProfile = function () {
  closeProfileModal();
  if (typeof window.dmKisiSec === 'function') window.dmKisiSec(currentModalProfileKey);
  activateMainView('dm', document.getElementById('iconBtnDm'));
};

window.closeProfileModal = function () { document.getElementById('profileModal').classList.add('hidden'); };
window.toggleFollowFromModal = function () { toggleFollow(currentModalProfileKey); openProfileModalByKey(currentModalProfileKey); };
window.toggleFollow = function (userKey) {
  const k = cleanKey(userKey);
  if (isMe(k)) return;
  if (followedUsers.includes(k)) followedUsers = followedUsers.filter(function (x) { return x !== k; });
  else followedUsers.push(k);
  localStorage.setItem('s360_following', JSON.stringify(followedUsers));
  if (typeof renderFeed === 'function') renderFeed();
  renderSuggestedUsers();
};