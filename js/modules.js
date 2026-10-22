// ============================================================================
// ŞANTİYE360 — MODÜLLER (js/modules.js)
// Maket, Pafta, Depo, Sözleşme, Ledger, Hava ve Araçlar
// NOT: Harita (Leaflet ve CBS) işlemleri js/harita.js dosyasına taşınmıştır.
// ============================================================================

// ----------------------------------------------------------------------------
// BİNA KAT MAKETİ MOTORU
// ----------------------------------------------------------------------------
window.binaVerisiniOnar = function (model) {
  if (!model || !model.ayarlar) return null;
  const temizDaireler = {};
  const ham = model.daireler || {};
  Object.keys(ham).forEach(function (k) {
    const item = ham[k];
    if (item && typeof item === 'object' && item.no) {
      temizDaireler['d_' + item.no] = item;
    }
  });
  model.daireler = temizDaireler;
  return model;
};

window.guvenliBinaOlustur = function (katSayisi, kattaDaire, zeminTipi, girisYonu) {
  const veri = {
    ayarlar: { katSayisi: katSayisi, kattaDaire: kattaDaire, zeminTipi: zeminTipi, girisYonu: girisYonu },
    daireler: {}
  };
  let sayac = 1;
  for (let k = 1; k <= katSayisi; k++) {
    for (let d = 1; d <= kattaDaire; d++) {
      let cephe = 'Ön Cephe (Giriş Yönü)';
      if (d > Math.ceil(kattaDaire / 2)) cephe = 'Arka Cephe (Bahçe Yönü)';
      if (kattaDaire >= 4 && d === 1) cephe = 'Sol Yan & Ön Köşe';
      if (kattaDaire >= 4 && d === kattaDaire) cephe = 'Sağ Yan & Arka Köşe';

      let tip = '3+1 · 135 m²';
      if (k === 1 && zeminTipi === 'Standard') tip = d <= Math.ceil(kattaDaire / 2) ? '2+1 Giriş Katı' : '3+1 Bahçe Kullanımlı';
      if (k === 1 && zeminTipi === 'Ticari') tip = 'Cadde Mağaza / Ticari';

      veri.daireler['d_' + sayac] = {
        no: sayac,
        kat: k,
        kapiSirasi: d,
        cephe: cephe,
        tip: tip,
        fiyat: 3800000 + (k * 300000) + (cephe.indexOf('Ön') !== -1 ? 350000 : 0),
        durum: 'satilik',
        musteri: ''
      };
      sayac++;
    }
  }
  return veri;
};

// Açılışta bozuk model varsa onar
try {
  const bozukOlabilenBina = JSON.parse(localStorage.getItem(window.roomStorageKey('s360_bina')));
  window.binaModeli = window.binaVerisiniOnar(bozukOlabilenBina) || window.guvenliBinaOlustur(5, 4, 'Standard', 'Güney (Ön Cadde)');
} catch (e) {
  window.binaModeli = window.guvenliBinaOlustur(5, 4, 'Standard', 'Güney (Ön Cadde)');
}

window.syncSafeBinaToCloud = async function () {
  localStorage.setItem(window.roomStorageKey('s360_bina'), JSON.stringify(window.binaModeli));
  if (activeRoomId) {
    try {
      await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/bina.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.binaModeli)
      });
    } catch (e) {}
  }
};

window.binaSifirdanOlustur = function () {
  const kat = Math.min(30, Math.max(1, parseInt(document.getElementById('binaKatSayisiInput').value, 10) || 5));
  const daire = Math.min(12, Math.max(1, parseInt(document.getElementById('binaKattaDaireInput').value, 10) || 4));
  const zemin = document.getElementById('binaZeminTipiInput').value;
  const giris = document.getElementById('binaGirisYonuInput').value;

  window.binaModeli = window.guvenliBinaOlustur(kat, daire, zemin, giris);
  window.seciliDaireNo = 1;
  window.syncSafeBinaToCloud();
  window.maketCiz();
};

window.setBinaCepheFiltre = function (filtre) {
  window.aktifCepheFiltre = filtre;
  ['ALL', 'ON', 'ARKA', 'YAN'].forEach(function (f) {
    const b = document.getElementById('cepheBtn_' + f);
    if (b) b.className = f === filtre
      ? 'px-3 py-1.5 rounded-md text-xs font-semibold bg-[#19C7B1] text-[#091311]'
      : 'px-3 py-1.5 rounded-md text-xs font-medium bg-[#1C222B] text-[#A6B0BF] hover:text-white';
  });
  window.maketCiz();
};

window.maketCiz = function () {
  try {
    const el = document.getElementById('binaKatIzgarasi');
    if (!el || !window.binaModeli || !window.binaModeli.ayarlar) return;

    window.binaModeli = window.binaVerisiniOnar(window.binaModeli);
    const ayarlar = window.binaModeli.ayarlar;
    const katSayisi = ayarlar.katSayisi || 5;
    const kattaDaire = ayarlar.kattaDaire || 4;
    const zeminTipi = ayarlar.zeminTipi || 'Standard';
    const girisYonu = ayarlar.girisYonu || 'Güney';

    document.getElementById('binaKatSayisiInput').value = katSayisi;
    document.getElementById('binaKattaDaireInput').value = kattaDaire;
    document.getElementById('binaGirisAltBar').innerHTML =
      '<span class="text-[#A6B0BF]">🚗 Otopark & Yan Giriş</span>' +
      '<span class="font-bold text-[#19C7B1]">🚪 BİNA ANA GİRİŞ KAPISI (' + window.esc(girisYonu.toUpperCase()) + ')</span>' +
      '<span class="text-[#A6B0BF]">🌳 Bahçe & Peyzaj Çıkışı</span>';

    const tumDaireler = Object.values(window.binaModeli.daireler || {}).filter(Boolean);
    let html = '';

    for (let k = katSayisi; k >= 1; k--) {
      const katEtiket = (k === 1 && zeminTipi === 'Standard') ? 'ZEMİN / BAHÇE' : (k === 1 && zeminTipi === 'Ticari' ? 'ZEMİN TİCARİ' : (k + '. KAT'));

      const buKattakiDaireler = tumDaireler.filter(function (item) {
        if (!item || item.kat !== k) return false;
        if (window.aktifCepheFiltre === 'ON') return (item.cephe || '').indexOf('Ön') !== -1;
        if (window.aktifCepheFiltre === 'ARKA') return (item.cephe || '').indexOf('Arka') !== -1;
        if (window.aktifCepheFiltre === 'YAN') return (item.cephe || '').indexOf('Yan') !== -1;
        return true;
      });

      if (buKattakiDaireler.length === 0) continue;

      html += '<div class="flex items-stretch gap-3">' +
        '<div class="w-24 ds-panel flex flex-col items-center justify-center p-2 text-center">' +
          '<span class="text-xs font-mono font-bold text-white">' + window.esc(katEtiket) + '</span>' +
        '</div>' +
        '<div class="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">';

      buKattakiDaireler.forEach(function (item) {
        const isSel = window.seciliDaireNo === item.no;
        let dot = 'bg-[#19C7B1]';
        if (item.durum === 'kapora') dot = 'bg-amber-400';
        if (item.durum === 'satildi') dot = 'bg-[#F04491]';
        if (item.durum === 'arsa') dot = 'bg-slate-400';

        const selClass = isSel ? 'border-[#19C7B1] ring-1 ring-[#19C7B1] bg-[#161B22]' : 'hover:border-[#384150]';

        html += '<div data-baction="select-flat" data-no="' + Number(item.no) + '" class="ds-panel p-2.5 cursor-pointer transition ' + selClass + '">' +
          '<div class="flex items-center justify-between">' +
            '<span class="font-semibold text-xs text-white">Daire ' + Number(item.no) + '</span>' +
            '<span class="w-2.5 h-2.5 rounded-full ' + dot + '"></span>' +
          '</div>' +
          '<div class="text-xs text-[#19C7B1] font-medium truncate mt-0.5">' + window.esc(item.cephe) + '</div>' +
          '<div class="text-xs text-[#A6B0BF] truncate">' + window.esc(item.tip) + '</div>' +
          '<div class="flex justify-between items-center mt-1 pt-1 border-t border-[#262C36]">' +
            '<span class="text-xs font-mono font-semibold text-white">' + (Number(item.fiyat) / 1000000).toFixed(2) + 'M ₺</span>' +
            '<span class="text-xs text-[#8E98A8] truncate max-w-[70px]">' + window.esc(item.musteri || 'Müsait') + '</span>' +
          '</div>' +
        '</div>';
      });

      html += '</div></div>';
    }
    el.innerHTML = html;

    const cur = window.binaModeli.daireler['d_' + window.seciliDaireNo] || window.binaModeli.daireler[window.seciliDaireNo];
    if (cur) {
      document.getElementById('maketSeciliBaslik').textContent = cur.kat + '. Kat · Bağımsız Bölüm No: ' + cur.no;
      document.getElementById('maketCepheSelect').value = cur.cephe;
      document.getElementById('maketTipInput').value = cur.tip;
      document.getElementById('maketFiyatInput').value = cur.fiyat;
      document.getElementById('maketMusteriInput').value = cur.musteri || '';
      document.getElementById('maketDurumSelect').value = cur.durum;
    }
  } catch (err) {}
};

window.maketDaireKaydet = function () {
  const key = 'd_' + window.seciliDaireNo;
  const cur = window.binaModeli.daireler[key] || window.binaModeli.daireler[window.seciliDaireNo];
  if (!cur) return;
  cur.cephe = document.getElementById('maketCepheSelect').value;
  cur.tip = document.getElementById('maketTipInput').value.trim() || cur.tip;
  cur.fiyat = parseFloat(document.getElementById('maketFiyatInput').value) || cur.fiyat;
  cur.musteri = document.getElementById('maketMusteriInput').value.trim();
  cur.durum = document.getElementById('maketDurumSelect').value;
  window.binaModeli.daireler[key] = cur;
  window.syncSafeBinaToCloud();
  window.maketCiz();
};

// ----------------------------------------------------------------------------
// PAFTA MOTORU
// ----------------------------------------------------------------------------
window.paftaPinleri = JSON.parse(localStorage.getItem(window.roomStorageKey('s360_pafta_pins'))) || [];

window.syncPaftaToCloud = async function () {
  localStorage.setItem(window.roomStorageKey('s360_pafta_pins'), JSON.stringify(window.paftaPinleri));
  if (activeRoomId) {
    try {
      if (window.paftaPinleri.length === 0) {
        await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/paftaPinleri.json', { method: 'DELETE' });
      } else {
        await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/paftaPinleri.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(window.paftaPinleri)
        });
      }
    } catch (e) {}
  }
};

window.paftaGorselYukle = function (input) {
  if (!input.files || !input.files[0]) return;
  if (typeof window.compressImageFile === 'function') {
    window.compressImageFile(input.files[0], 900, function (b64) {
      document.getElementById('paftaAnaGorsel').src = b64;
    });
  }
};

window.paftayaTiklaPinEkle = function (e) {
  const rect = document.getElementById('paftaCanvasContainer').getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
  const inp = document.getElementById('paftaPinNotInput');
  window.paftaPinleri.push({ id: Date.now(), no: window.paftaPinleri.length + 1, x: x, y: y, not: inp.value.trim() || ('Kontrol Noktası (%' + x + ', %' + y + ')'), yazar: currentAccount ? currentAccount.name : 'Uzman' });
  window.syncPaftaToCloud();
  inp.value = '';
  window.paftaPinleriCiz();
};

window.paftaTekPinSil = function (id) {
  window.paftaPinleri = window.paftaPinleri.filter(function (p) { return p.id !== id; }).map(function (p, idx) { return { id: p.id, no: idx + 1, x: p.x, y: p.y, not: p.not, yazar: p.yazar }; });
  window.syncPaftaToCloud();
  window.paftaPinleriCiz();
};

window.paftaPinleriTemizle = function () {
  window.paftaPinleri = [];
  window.syncPaftaToCloud();
  window.paftaPinleriCiz();
};

window.paftaPinleriCiz = function () {
  const k = document.getElementById('paftaPinKatmani');
  const l = document.getElementById('paftaPinListesi');
  if (!k || !l) return;
  k.innerHTML = window.paftaPinleri.map(function (p) {
    return '<div style="left:' + Number(p.x) + '%;top:' + Number(p.y) + '%;" class="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F04491] text-white font-mono font-bold text-xs flex items-center justify-center border border-white">' + Number(p.no) + '</div>';
  }).join('');
  l.innerHTML = window.paftaPinleri.length === 0
    ? '<div class="text-xs text-[#8E98A8] text-center py-10">Görsele tıklayarak revizyon noktası ekleyin.</div>'
    : window.paftaPinleri.map(function (p) {
      return '<div class="p-2.5 rounded-lg bg-[#161B22] border border-[#262C36] text-xs flex justify-between items-start gap-2">' +
        '<div><span class="font-mono font-bold text-[#F04491] mr-1.5">#' + Number(p.no) + '</span><span class="text-white">' + window.esc(p.not) + '</span><div class="text-xs text-[#8E98A8] mt-0.5">' + window.esc(p.yazar) + '</div></div>' +
        '<button data-baction="delete-pafta-pin" data-id="' + Number(p.id) + '" class="text-[#8E98A8] hover:text-[#F04491]"><i class="fa-solid fa-trash"></i></button>' +
      '</div>';
    }).join('');
};

// ----------------------------------------------------------------------------
// DEPO & STOK
// ----------------------------------------------------------------------------
window.stokVerisi = JSON.parse(localStorage.getItem(window.roomStorageKey('s360_stok'))) || [];

window.syncRoomStokToCloud = async function () {
  localStorage.setItem(window.roomStorageKey('s360_stok'), JSON.stringify(window.stokVerisi));
  if (activeRoomId) {
    try {
      if (window.stokVerisi.length === 0) {
        await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/stok.json', { method: 'DELETE' });
      } else {
        await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/stok.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(window.stokVerisi)
        });
      }
    } catch (e) {}
  }
};

window.yeniEnvanterKalemiEkle = function () {
  const ad = document.getElementById('yeniStokAd').value.trim();
  const miktar = parseFloat(document.getElementById('yeniStokMiktar').value) || 0;
  const birim = document.getElementById('yeniStokBirim').value.trim() || 'Adet';
  if (!ad) return alert('Lütfen malzeme veya mamul adını yazın.');

  window.stokVerisi.unshift({
    id: Date.now(),
    ad: ad,
    miktar: miktar,
    birim: birim,
    kritik: Math.max(1, Math.round(miktar * 0.2))
  });
  window.syncRoomStokToCloud();
  document.getElementById('yeniStokAd').value = '';
  document.getElementById('yeniStokMiktar').value = '';
  document.getElementById('yeniStokBirim').value = '';
  window.stokEkraniCiz();
};

window.stokGuncelle = function (i, d) {
  if (!window.stokVerisi[i]) return;
  window.stokVerisi[i].miktar = Math.max(0, window.stokVerisi[i].miktar + d);
  window.syncRoomStokToCloud();
  window.stokEkraniCiz();
};

window.stokKalemiSil = function (i) {
  window.stokVerisi.splice(i, 1);
  window.syncRoomStokToCloud();
  window.stokEkraniCiz();
};

window.stokEkraniCiz = function () {
  const k = document.getElementById('stokListesi');
  if (!k) return;
  if (window.stokVerisi.length === 0) {
    k.innerHTML = '<div class="col-span-2 text-xs text-[#8E98A8] text-center py-8">Depoda kayıtlı malzeme yok. Yukarıdan kendi envanterinizi ekleyin.</div>';
    return;
  }
  k.innerHTML = window.stokVerisi.map(function (s, i) {
    const statusClass = s.miktar <= s.kritik ? 'text-[#F04491]' : 'text-[#19C7B1]';
    const statusText = s.miktar <= s.kritik ? '⚠️ Kritik Stok' : '✔ Stok Yeterli';
    return '<div class="ds-panel p-4 flex items-center justify-between gap-2">' +
      '<div><div class="font-medium text-xs text-white">' + window.esc(s.ad) + '</div><div class="text-xs ' + statusClass + ' mt-0.5">' + statusText + '</div></div>' +
      '<div class="flex items-center gap-1.5">' +
        '<button data-baction="stok-degistir" data-idx="' + i + '" data-delta="-1" class="ds-btn-secondary px-2.5 py-1">-</button>' +
        '<span class="font-mono font-semibold text-xs text-white w-20 text-center">' + Number(s.miktar) + ' ' + window.esc(s.birim) + '</span>' +
        '<button data-baction="stok-degistir" data-idx="' + i + '" data-delta="1" class="ds-btn-secondary px-2.5 py-1">+</button>' +
        '<button data-baction="stok-sil" data-idx="' + i + '" class="ds-btn-secondary px-2 py-1 text-[#F04491] ml-1" title="Envanterden Sil"><i class="fa-solid fa-trash"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');
};

// ----------------------------------------------------------------------------
// SÖZLEŞME VE FİNANS MOTORU
// ----------------------------------------------------------------------------
window.taksitListesi = [];

window.hesaplaTaksitPlani = function () {
  const top = parseFloat(document.getElementById('sozToplam').value) || 0;
  const pes = parseFloat(document.getElementById('sozPesinat').value) || 0;
  const vade = Math.max(1, parseInt(document.getElementById('sozVade').value, 10) || 12);
  const faizYuzde = Math.max(0, parseFloat(document.getElementById('sozFaizOrani').value) || 0);

  const anapara = Math.max(0, top - pes);
  const toplamFaiz = Math.round(anapara * (faizYuzde / 100) * vade);
  const vadeliToplam = anapara + toplamFaiz;
  const aylik = Math.round(vadeliToplam / vade);

  document.getElementById('sozKalanBorc').textContent = anapara.toLocaleString('tr-TR') + ' ₺';
  document.getElementById('sozToplamFaiz').textContent = toplamFaiz.toLocaleString('tr-TR') + ' ₺';
  document.getElementById('sozGenelToplam').textContent = (pes + vadeliToplam).toLocaleString('tr-TR') + ' ₺';
  document.getElementById('sozAylikTaksit').textContent = aylik.toLocaleString('tr-TR') + ' ₺ / Ay';

  window.taksitListesi = [];
  const now = new Date();
  for (let i = 1; i <= vade; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 15).toLocaleDateString('tr-TR');
    window.taksitListesi.push({ no: i, tarih: d, tutar: aylik });
  }
  window.renderTaksitKutulari();
};

window.taksitRevizeEt = function (idx) {
  const cur = window.taksitListesi[idx];
  if (!cur) return;
  const yeni = prompt(cur.no + '. Taksit (' + cur.tarih + ') tutarını revize edin (₺):', cur.tutar);
  if (yeni === null) return;
  cur.tutar = parseFloat(yeni) || cur.tutar;
  window.renderTaksitKutulari();
};

window.renderTaksitKutulari = function () {
  const t = document.getElementById('sozTaksitTablosu');
  if (!t) return;
  t.innerHTML = window.taksitListesi.map(function (item, idx) {
    return '<div data-baction="revize-taksit" data-idx="' + idx + '" class="ds-panel p-2.5 text-center cursor-pointer hover:border-[#19C7B1] transition" title="Tutarı revize etmek için tıklayın">' +
      '<div class="text-xs text-[#A6B0BF]">' + Number(item.no) + '. Senet · ' + window.esc(item.tarih) + '</div>' +
      '<div class="font-mono font-semibold text-white mt-0.5">' + Number(item.tutar).toLocaleString('tr-TR') + ' ₺</div>' +
    '</div>';
  }).join('');
};

window.yazdirResmiSozlesme = function () {
  const musteri = document.getElementById('sozMusteri').value || 'Belirtilmedi';
  const toplam = parseFloat(document.getElementById('sozToplam').value) || 0;
  const pesinat = parseFloat(document.getElementById('sozPesinat').value) || 0;
  const vade = parseInt(document.getElementById('sozVade').value, 10) || 12;
  const faiz = parseFloat(document.getElementById('sozFaizOrani').value) || 0;
  const kalanBorc = document.getElementById('sozKalanBorc').textContent;
  const toplamFaiz = document.getElementById('sozToplamFaiz').textContent;
  const genelToplam = document.getElementById('sozGenelToplam').textContent;
  const tarih = new Date().toLocaleDateString('tr-TR');
  const duzenleyen = (typeof currentAccount !== 'undefined' && currentAccount) ? currentAccount.name : 'Yetkili Uzman';

  // Taksit satırlarını HTML tablosuna çevir
  const satirlarHtml = (window.taksitListesi || []).map(function (t) {
    return `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px;">${t.no}. Senet</td><td style="padding: 10px;">${t.tarih}</td><td style="padding: 10px;"><strong>${Number(t.tutar).toLocaleString('tr-TR')} ₺</strong></td></tr>`;
  }).join('');

  // PDF için sanal ve stillendirilmiş bir HTML şablonu oluştur
  const pdfContainer = document.createElement('div');
  pdfContainer.innerHTML = `
    <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; background: #fff;">
        <div style="text-align: center; border-bottom: 3px solid #19C7B1; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #111; font-size: 26px; margin: 0; letter-spacing: -1px;">ŞANTİYE360 PLATFORMU</h1>
            <h2 style="color: #555; font-size: 16px; margin: 5px 0 0 0; font-weight: normal;">Kurumsal Gayrimenkul Satış ve Vadeli Ödeme Planı</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px;">
            <div><strong>Alıcı:</strong> ${musteri}</div>
            <div><strong>Tarih:</strong> ${tarih}</div>
        </div>
        <div style="margin-bottom: 30px; font-size: 14px;"><strong>Düzenleyen (Uzman/Firma):</strong> ${duzenleyen}</div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 14px;">
            <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Satış Bedeli</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace;">${toplam.toLocaleString('tr-TR')} ₺</td>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Peşinat</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace;">${pesinat.toLocaleString('tr-TR')} ₺</td>
            </tr>
            <tr>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Kalan Anapara</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace;">${kalanBorc}</td>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Vade Farkı (%${faiz})</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace; color: #d97706;">${toplamFaiz}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Vade Sayısı</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb;">${vade} Ay</td>
                <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Vadeli Genel Toplam</th>
                <td style="padding: 12px; border: 1px solid #e5e7eb; font-family: monospace; font-size: 16px;"><strong>${genelToplam}</strong></td>
            </tr>
        </table>

        <h3 style="color: #111; font-size: 16px; margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">SENET / TAKSİT ÖDEME TAKVİMİ</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
            <thead>
                <tr style="background-color: #19C7B1; color: white;">
                    <th style="padding: 12px;">Taksit No</th>
                    <th style="padding: 12px;">Vade Tarihi</th>
                    <th style="padding: 12px;">Ödeme Tutarı</th>
                </tr>
            </thead>
            <tbody>${satirlarHtml}</tbody>
        </table>

        <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Sistem Tarafından Üretilmiştir (Şantiye360 Platformu) • Bu doküman bilgilendirme amaçlıdır.
        </div>
    </div>
  `;

  // html2pdf Ayarları
  const opt = {
    margin:       0,
    filename:     'Santiye360_Odeme_Plani_' + musteri.replace(/\s+/g, '_') + '.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(pdfContainer).save();
  } else {
    alert("PDF kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.");
  }
};

// ----------------------------------------------------------------------------
// HAKEDİŞ VE KASA (LEDGER) MOTORU
// ----------------------------------------------------------------------------
window.kasaVerisi = JSON.parse(localStorage.getItem(window.roomStorageKey('s360_ledger'))) || [];

window.getLedger = function () {
  return window.kasaVerisi || [];
};

window.syncLedgerToCloud = async function (list) {
  window.kasaVerisi = list;
  localStorage.setItem(window.roomStorageKey('s360_ledger'), JSON.stringify(list));
  if (!activeRoomId) return;
  try {
    if (list.length === 0) {
      await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/kasa.json', { method: 'DELETE' });
    } else {
      await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/kasa.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });
    }
  } catch (err) {}
};

window.loadRoomLedgerFromCloud = async function () {
  if (!activeRoomId) {
    window.renderLedger();
    return;
  }
  try {
    const cloudList = await window.fbJsonRequest('/santiye360_oda_verileri/' + activeRoomId + '/kasa.json');
    if (Array.isArray(cloudList)) {
      window.kasaVerisi = cloudList.filter(Boolean);
      localStorage.setItem(window.roomStorageKey('s360_ledger'), JSON.stringify(window.kasaVerisi));
    }
    window.renderLedger();
  } catch (e) {}
};

window.renderLedger = function () {
  const list = window.getLedger();
  const box = document.getElementById('ledgerList');
  if (!box) return;
  let total = 0, paid = 0;

  if (list.length === 0) {
    box.innerHTML = '<div class="text-xs text-[#8E98A8] py-6 text-center">Henüz hakediş veya ödeme kaydı eklenmedi.</div>';
  } else {
    box.innerHTML = list.map(function (item) {
      total += item.amount;
      if (item.paid) paid += item.amount;
      const btnClass = item.paid ? 'ds-btn-secondary text-[#19C7B1]' : 'ds-btn-primary';
      const btnText = item.paid ? 'Ödendi' : 'Ödeme Yap';
      return '<div class="ds-panel p-3 flex flex-wrap justify-between items-center gap-2 text-xs">' +
        '<div><div class="font-semibold text-white">' + window.esc(item.name) + '</div><div class="text-[#19C7B1] font-medium">' + window.esc(item.job) + '</div></div>' +
        '<div class="flex items-center gap-2.5">' +
          '<span class="font-mono font-semibold text-white">' + Number(item.amount).toLocaleString('tr-TR') + ' ₺</span>' +
          '<button type="button" data-action="toggle-ledger" data-id="' + Number(item.id) + '" class="' + btnClass + ' py-1 px-2.5">' + btnText + '</button>' +
          '<button type="button" data-action="edit-ledger" data-id="' + Number(item.id) + '" class="ds-btn-secondary py-1 px-2 text-[#A6B0BF] hover:text-white" title="Düzenle"><i class="fa-solid fa-pen"></i></button>' +
          '<button type="button" data-action="delete-ledger" data-id="' + Number(item.id) + '" class="ds-btn-secondary py-1 px-2 text-[#F04491]" title="Sil"><i class="fa-solid fa-trash"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  document.getElementById('ledgerTotal').textContent = total.toLocaleString('tr-TR') + ' ₺';
  document.getElementById('ledgerPaid').textContent = paid.toLocaleString('tr-TR') + ' ₺';
  document.getElementById('ledgerRemaining').textContent = (total - paid).toLocaleString('tr-TR') + ' ₺';
};

window.addLedgerItem = function () {
  const name = document.getElementById('legName').value.trim();
  const job = document.getElementById('legJob').value.trim() || 'Genel İmalat';
  const amount = parseFloat(document.getElementById('legAmount').value);
  if (!name || !amount) return alert('Lütfen firma/usta adını ve tutarı girin.');
  const list = window.getLedger();
  list.unshift({ id: Date.now(), name: name, job: job, amount: amount, paid: false });
  window.syncLedgerToCloud(list);
  document.getElementById('legName').value = '';
  document.getElementById('legJob').value = '';
  document.getElementById('legAmount').value = '';
  window.renderLedger();
};

window.editLedgerItem = function (id) {
  const list = window.getLedger();
  const item = list.find(function (i) { return i.id === id; });
  if (!item) return;
  const newJob = prompt('İş / İmalat Kalemini Düzenle:', item.job);
  if (newJob === null) return;
  const newAmt = prompt('Tutarı Düzenle (₺):', item.amount);
  if (newAmt === null) return;
  item.job = newJob.trim() || item.job;
  item.amount = parseFloat(newAmt) || item.amount;
  window.syncLedgerToCloud(list);
  window.renderLedger();
};

window.deleteLedgerItem = function (id) {
  const list = window.getLedger().filter(function (i) { return i.id !== id; });
  window.syncLedgerToCloud(list);
  window.renderLedger();
};

window.toggleLedgerPaid = function (id) {
  const list = window.getLedger().map(function (i) { if (i.id === id) i.paid = !i.paid; return i; });
  window.syncLedgerToCloud(list);
  window.renderLedger();
};

// ----------------------------------------------------------------------------
// BETON, HAVA & ARAÇLAR MOTORU
// ----------------------------------------------------------------------------
window.fetchRealWeather = async function () {
  const sel = document.getElementById('weatherCitySelect');
  if (!sel) return;
  const val = sel.value.split(',');
  const cityName = val[2] || 'Ankara';
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + val[0] + '&longitude=' + val[1] + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto');
    const data = await res.json();
    if (data && data.current) {
      document.getElementById('tempInput').value = Math.round(data.current.temperature_2m);
      document.getElementById('humInput').value = Math.round(data.current.relative_humidity_2m);
      document.getElementById('windInput').value = Math.round(data.current.wind_speed_10m);
      document.getElementById('weatherStatusText').textContent = cityName + ' anlık uydu ölçümü: ' + Math.round(data.current.temperature_2m) + '°C, Nem %' + Math.round(data.current.relative_humidity_2m) + ', Rüzgar ' + Math.round(data.current.wind_speed_10m) + ' km/s';
      window.calculateCuring();

      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const grid = document.getElementById('weeklyForecastGrid');
      if (grid && data.daily) {
        grid.innerHTML = '';
        for (let i = 0; i < 7; i++) {
          const d = new Date(data.daily.time[i]);
          const dayName = i === 0 ? 'Bugün' : days[d.getDay()];
          const maxT = Math.round(data.daily.temperature_2m_max[i]);
          const minT = Math.round(data.daily.temperature_2m_min[i]);
          const rain = data.daily.precipitation_probability_max[i];

          let statusBadge = '<span class="text-xs text-[#19C7B1] font-semibold">Uygun</span>';
          if (minT <= 3) statusBadge = '<span class="text-xs text-[#F04491] font-semibold">Soğuk/Don</span>';
          else if (rain > 55) statusBadge = '<span class="text-xs text-amber-400 font-semibold">%' + rain + ' Yağış</span>';

          grid.innerHTML += '<div class="ds-panel p-3 space-y-1">' +
            '<div class="font-semibold text-white">' + dayName + '</div>' +
            '<div class="font-mono text-xs text-[#A6B0BF]">' + maxT + '° / ' + minT + '°C</div>' +
            '<div>' + statusBadge + '</div>' +
          '</div>';
        }
      }
    }
  } catch (e) {
    window.calculateCuring();
  }
};

window.calculateCuring = function () {
  const temp = parseInt(document.getElementById('tempInput').value, 10);
  const hum = parseInt(document.getElementById('humInput').value, 10);
  const wind = parseInt(document.getElementById('windInput').value, 10);

  document.getElementById('tempLabel').textContent = temp + '°C';
  document.getElementById('humLabel').textContent = '%' + hum;
  document.getElementById('windLabel').textContent = wind + ' km/s';

  const banner = document.getElementById('weatherVisualAlertBanner');
  const icon = document.getElementById('weatherAlertIcon');
  const verdict = document.getElementById('pourVerdictBadge');
  const advice = document.getElementById('chefAdvice');
  const maturity = document.getElementById('weatherMaturityIndex');

  const frostRisk = temp < 5 ? Math.min(100, Math.round((5 - temp) * 12 + 40)) : 0;
  const shrinkRisk = Math.min(100, Math.max(5, Math.round((temp > 25 ? (temp - 25) * 4 : 0) + (wind * 1.1) + (hum < 50 ? (50 - hum) : 0))));
  const craneRisk = Math.min(100, Math.round((wind / 55) * 100));

  document.getElementById('frostRiskText').textContent = '%' + frostRisk + ' ' + (frostRisk > 30 ? '(YÜKSEK)' : '(Düşük)');
  document.getElementById('frostRiskBar').style.width = Math.max(4, frostRisk) + '%';
  document.getElementById('frostRiskBar').className = 'h-full transition-all ' + (frostRisk > 30 ? 'bg-[#F04491]' : 'bg-[#19C7B1]');

  document.getElementById('shrinkRiskText').textContent = '%' + shrinkRisk + ' ' + (shrinkRisk > 60 ? '(YÜKSEK)' : '(Normal)');
  document.getElementById('shrinkRiskBar').style.width = shrinkRisk + '%';
  document.getElementById('shrinkRiskBar').className = 'h-full transition-all ' + (shrinkRisk > 60 ? 'bg-amber-400' : 'bg-[#19C7B1]');

  document.getElementById('craneRiskText').textContent = '%' + craneRisk + ' (' + wind + ' km/s)';
  document.getElementById('craneRiskBar').style.width = craneRisk + '%';
  document.getElementById('craneRiskBar').className = 'h-full transition-all ' + (wind >= 45 ? 'bg-[#F04491]' : 'bg-[#19C7B1]');

  if (temp < 5) {
    banner.className = 'p-4 rounded-xl border border-[#F04491] bg-[#F04491]/15 flex items-center justify-between gap-4';
    icon.className = 'w-10 h-10 rounded-lg bg-[#F04491] text-white flex items-center justify-center text-lg font-bold';
    icon.textContent = '❄️';
    verdict.textContent = 'UYARI: DÜŞÜK SICAKLIK / DON RİSKİ — ÖNLEM GEREKLİ';
    advice.textContent = '5°C altında çimento hidratasyonu yavaşlar, 0°C altında don riski başlar. Sorumlu mühendis kontrolünde antifriz ve termal koruma uygulanmalıdır.';
    document.getElementById('initialSetTime').textContent = '~8 - 12 Saat';
    document.getElementById('cureDays').textContent = '~14+ Gün';
    maturity.textContent = 'Reaksiyon: Yavaş';
  } else if (temp > 32 || shrinkRisk > 65 || wind >= 45) {
    banner.className = 'p-4 rounded-xl border border-amber-400 bg-amber-400/15 flex items-center justify-between gap-4';
    icon.className = 'w-10 h-10 rounded-lg bg-amber-400 text-black flex items-center justify-center text-lg font-bold';
    icon.textContent = '⚠️';
    verdict.textContent = 'DİKKAT: YÜKSEK BUHARLAŞMA VE PLASTİK RÖTRE RİSKİ';
    advice.textContent = 'Sıcaklık ve rüzgar yüzey suyunu hızla buharlaştırabilir. Döküm sonrası yüzey koruma ve düzenli sulama/kürleme önerilir.';
    document.getElementById('initialSetTime').textContent = '~1.5 - 2.5 Saat';
    document.getElementById('cureDays').textContent = '~7+ Gün (Sürekli Kür)';
    maturity.textContent = 'Reaksiyon: Hızlı';
  } else {
    banner.className = 'p-4 rounded-xl border border-[#19C7B1]/40 bg-[#19C7B1]/10 flex items-center justify-between gap-4';
    icon.className = 'w-10 h-10 rounded-lg bg-[#19C7B1] text-[#091311] flex items-center justify-center text-lg font-bold';
    icon.textContent = '✓';
    verdict.textContent = 'BETON DÖKÜMÜNE UYGUN — STANDART SAHA KOŞULLARI';
    advice.textContent = 'Sıcaklık, nem ve rüzgar değerleri standart döküm için uygun aralıktadır.';
    document.getElementById('initialSetTime').textContent = '~3 - 4 Saat';
    document.getElementById('cureDays').textContent = '~7 Gün';
    maturity.textContent = 'Reaksiyon: Normal';
  }
};

window.editMarketUnitPrices = function () {
  const curRebar = localStorage.getItem('s360_rebar_price') || '24.850';
  const curConc = localStorage.getItem('s360_conc_price') || '2.450';
  const newRebar = prompt('Güncel Nervürlü Demir Ton Fiyatı (₺/t):', curRebar);
  if (newRebar !== null && newRebar.trim()) {
    localStorage.setItem('s360_rebar_price', newRebar.trim());
    document.getElementById('headerRebarPrice').textContent = newRebar.trim() + ' ₺/t';
  }
  const newConc = prompt('Güncel C30 Hazır Beton Fiyatı (₺/m³):', curConc);
  if (newConc !== null && newConc.trim()) {
    localStorage.setItem('s360_conc_price', newConc.trim());
    document.getElementById('headerConcretePrice').textContent = newConc.trim() + ' ₺/m³';
  }
};

window.fetchRealCurrencies = async function () {
  const savedRebar = localStorage.getItem('s360_rebar_price');
  const savedConc = localStorage.getItem('s360_conc_price');
  if (savedRebar) document.getElementById('headerRebarPrice').textContent = savedRebar + ' ₺/t';
  if (savedConc) document.getElementById('headerConcretePrice').textContent = savedConc + ' ₺/m³';

  try {
    const res = await window.fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data && data.rates && data.rates.TRY) {
      liveUsdRate = data.rates.TRY;
      document.getElementById('usdVal').textContent = liveUsdRate.toFixed(2) + ' ₺';
      if (data.rates.EUR) {
        document.getElementById('eurVal').textContent = (data.rates.TRY / data.rates.EUR).toFixed(2) + ' ₺';
      }
      window.runFeasibility();
    }
  } catch (error) {}
};

window.updateCompass = function () {
  const deg = parseInt(document.getElementById('degreeSlider').value, 10);
  const directions = ['Kuzey', 'Kuzeydoğu', 'Doğu', 'Güneydoğu', 'Güney', 'Güneybatı', 'Batı', 'Kuzeybatı'];
  const index = Math.round(deg / 45) % 8;
  const direction = directions[index];
  const premium = [3, 4, 5].includes(index) ? 15 : (index === 2 || index === 6 ? 5 : 0);

  document.getElementById('compassNeedle').style.transform = 'rotate(' + deg + 'deg)';
  document.getElementById('degreeTitle').textContent = deg + '° — ' + direction + ' Cephesi (+' + premium + '% Şerefiye Primi)';
  document.getElementById('serefiyeAdvice').textContent = premium === 15
    ? 'Güneş alan cepheler, konut projelerinde genellikle daha yüksek talep görür.'
    : premium === 5
      ? 'Cephe yönü ve gün ışığı, birimin değerini etkileyebilir.'
      : 'Kuzey cephelerinde güneşlenme daha sınırlı olabilir.';
};

window.runFeasibility = function () {
  const landArea = Number(document.getElementById('calcArsa').value) || 0;
  const emsal = Number(document.getElementById('calcEmsal').value) || 0;
  const bonusFactor = Number(document.getElementById('calcBonusFactor').value) || 1.30;
  const landShare = Number(document.getElementById('calcPay').value) || 50;
  const flatArea = Number(document.getElementById('calcDaireM2').value) || 100;
  const costPerM2 = Number(document.getElementById('calcCostPerM2').value) || 650;

  const emsalM2 = landArea * emsal;
  const totalArea = Math.round(emsalM2 * bonusFactor);
  const flatCount = flatArea > 0 ? Math.floor(emsalM2 / flatArea) : 0;
  const landFlats = Math.round(flatCount * (landShare / 100));
  const developerFlats = flatCount - landFlats;
  const estimatedCost = (totalArea * costPerM2 * liveUsdRate) / 1000000;

  document.getElementById('resTotalM2').textContent = totalArea.toLocaleString('tr-TR') + ' m²';
  document.getElementById('resTotalFlats').textContent = flatCount.toLocaleString('tr-TR') + ' Daire';
  document.getElementById('resSplit').textContent = developerFlats + ' / ' + landFlats;
  document.getElementById('resCost').textContent = estimatedCost.toFixed(1) + ' M ₺';
};

window.odaVerileriniBuluttanYukle = async function (roomCode) {
  if (!roomCode) return;
  try {
    const data = await window.fbJsonRequest('/santiye360_oda_verileri/' + roomCode + '.json');
    
    window.stokVerisi = (data && Array.isArray(data.stok)) ? data.stok.filter(Boolean) : [];
    localStorage.setItem(window.roomStorageKey('s360_stok'), JSON.stringify(window.stokVerisi));
    window.stokEkraniCiz();

    if (data && data.bina && data.bina.ayarlar) {
      window.binaModeli = window.binaVerisiniOnar(data.bina);
      localStorage.setItem(window.roomStorageKey('s360_bina'), JSON.stringify(window.binaModeli));
      window.maketCiz();
    }

    window.paftaPinleri = (data && Array.isArray(data.paftaPinleri)) ? data.paftaPinleri.filter(Boolean) : [];
    localStorage.setItem(window.roomStorageKey('s360_pafta_pins'), JSON.stringify(window.paftaPinleri));
    window.paftaPinleriCiz();
  } catch (e) {}
};

document.addEventListener('DOMContentLoaded', function () {
  try { window.renderLedger(); } catch (e) {}
  try { window.calculateCuring(); } catch (e) {}
  try { window.updateCompass(); } catch (e) {}
  try { window.fetchRealCurrencies(); } catch (e) {}
  try { window.fetchRealWeather(); } catch (e) {}
  try { window.maketCiz(); } catch (e) {}
  try { window.paftaPinleriCiz(); } catch (e) {}
  try { window.stokEkraniCiz(); } catch (e) {}
  try { window.hesaplaTaksitPlani(); } catch (e) {}
  
  // EĞER SAYFA HARİTA SEKMESİNDE AÇILDIYSA haritaBaslat() ÇAĞRILACAK (index.html içindeki activateMainView halledecek)

  if (typeof currentAccount !== 'undefined' && currentAccount && currentAccount.userKey) {
    document.getElementById('authGateModal').classList.add('hidden');
    if (typeof window.applyCurrentAccountUI === 'function') window.applyCurrentAccountUI();
    if (typeof window.loadCloudRatings === 'function') window.loadCloudRatings();
    if (typeof window.loadCloudUsersDirectory === 'function') window.loadCloudUsersDirectory();
    if (typeof window.loadCloudPosts === 'function') window.loadCloudPosts();
    if (typeof window.refreshUserSiteRooms === 'function') window.refreshUserSiteRooms();
    if (typeof activeRoomId !== 'undefined' && activeRoomId && typeof window.openVerifiedSiteRoom === 'function') window.openVerifiedSiteRoom(activeRoomId);
  } else {
    document.getElementById('authGateModal').classList.remove('hidden');
  }

  if (typeof window.runBackgroundRealtimeSync === 'function') {
    setInterval(window.runBackgroundRealtimeSync, 6000);
  }

  const kvkkCheck = document.getElementById('regKvkkCheck');
  if (kvkkCheck) kvkkCheck.checked = false;

  const kvkkModalText = document.querySelector('#kvkkModal .leading-relaxed');
  if (kvkkModalText) {
    kvkkModalText.innerHTML =
      '<p><strong>1. Veri Sorumlusu:</strong> ŞANTİYE360 Platform Yönetimi.</p>' +
      '<p><strong>2. İşlenen Veriler ve Amaç:</strong> Ad-soyad, mesleki unvan, sicil beyanı ve proje verileriniz yalnızca şantiye koordinasyonu ve portföy paylaşımı amacıyla işlenir. E-posta adresiniz halka açık profil dizininde yayınlanmaz.</p>' +
      '<p><strong>3. Saklama Süresi:</strong> Verileriniz üyeliğiniz aktif olduğu sürece ve yasal zamanaşımı süreleri boyunca saklanır.</p>' +
      '<p><strong>4. KVKK Madde 11 Haklarınız:</strong> Veri sorumlusuna başvurarak verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini talep etme hakkına sahipsiniz.</p>';
  }
});// ============================================================================
// EXCEL DIŞA AKTARMA (SheetJS)
// ============================================================================
window.exportLedgerToExcel = function () {
    if (!window.kasaVerisi || window.kasaVerisi.length === 0) {
        alert("Dışa aktarılacak kasa/hakediş verisi bulunamadı.");
        return;
    }
    
    // Veriyi Excel başlıklarıyla haritala
    const excelData = window.kasaVerisi.map(item => ({
        "Kayıt Tarihi": new Date(item.id).toLocaleDateString('tr-TR'),
        "Taşeron / Firma / Usta": item.name,
        "İş Kalemi / İmalat": item.job,
        "Tahakkuk Eden Tutar (₺)": item.amount,
        "Ödeme Durumu": item.paid ? "ÖDENDİ" : "AÇIK BAKİYE (BORÇ)"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hakedis_Kasa");
    XLSX.writeFile(wb, "Santiye360_Hakedis_Defteri.xlsx");
};

window.exportStokToExcel = function () {
    if (!window.stokVerisi || window.stokVerisi.length === 0) {
        alert("Dışa aktarılacak envanter verisi bulunamadı.");
        return;
    }

    // Veriyi Excel başlıklarıyla haritala
    const excelData = window.stokVerisi.map(item => ({
        "Malzeme / Mamul Adı": item.ad,
        "Mevcut Miktar": item.miktar,
        "Ölçü Birimi": item.birim,
        "Kritik Eşik Seviyesi": item.kritik,
        "Durum": item.miktar <= item.kritik ? "Kritik Stok Uyarı" : "Yeterli"
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Depo_Envanteri");
    XLSX.writeFile(wb, "Santiye360_Depo_Envanteri.xlsx");
};// ============================================================================
// PROPTECH AI FİZİBİLİTE ASİSTAN MOTORU
// ============================================================================
window.generateAIFeasibilityReport = function () {
    const reportContainer = document.getElementById('aiReportContainer');
    
    // Verileri Topla
    const landArea = Number(document.getElementById('calcArsa').value) || 0;
    const emsal = Number(document.getElementById('calcEmsal').value) || 0;
    const landShare = Number(document.getElementById('calcPay').value) || 50;
    const totalFlats = parseInt(document.getElementById('resTotalFlats').textContent) || 0;
    const devFlats = totalFlats - Math.round(totalFlats * (landShare / 100));
    const costText = document.getElementById('resCost').textContent;
    
    const compassDeg = parseInt(document.getElementById('degreeSlider').value, 10);
    const directions = ['Kuzey', 'Kuzeydoğu', 'Doğu', 'Güneydoğu', 'Güney', 'Güneybatı', 'Batı', 'Kuzeybatı'];
    const direction = directions[Math.round(compassDeg / 45) % 8];

    // Animasyon Etkisi
    reportContainer.innerHTML = '<div class="flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-[#19C7B1] text-2xl"></i><span class="ml-3 text-[#19C7B1]">AI Modelleri Çalıştırılıyor...</span></div>';

    setTimeout(() => {
        // AI Mantığı ile dinamik yorumlar üret
        let aiComment = '';
        if (emsal >= 2.0) aiComment = 'Yüksek yoğunluklu (KAKS ≥ 2.0) bu projede dikey yapılaşma potansiyeli maliyet avantajı sağlamaktadır. Ticari alan entegrasyonu önerilir.';
        else if (emsal >= 1.0) aiComment = 'Standart emsal değerine sahip bu parsel, yatay veya orta katlı karma konut projeleri için idealdir.';
        else aiComment = 'Düşük emsalli bu arsa, müstakil veya az katlı butik villa projeleri için uygundur. Birim satış fiyatı yüksek tutulmalıdır.';

        let serefComment = '';
        if (['Güney', 'Güneydoğu', 'Güneybatı'].includes(direction)) serefComment = `Seçilen ${direction} ağırlıklı cephe yönelimi, enerji verimliliğini artıracak ve satış hızını olumlu etkileyecektir (Tahmini Şerefiye Primi: +%10-15).`;
        else serefComment = `Seçilen ${direction} cephesi, izolasyon maliyetlerini kısmen artırabilir; iklimlendirme stratejisi ön planda olmalıdır.`;

        let riskComment = '';
        if (landShare > 50) riskComment = 'Arsa sahibi payının %50 üzerinde olması, müteahhit/geliştirici tarafında kar marjını daraltabilir. İnşaat maliyet optimizasyonu (Malzeme tedarik) kritiktir.';
        else riskComment = 'Geliştirici kar marjı optimum seviyededir. Satılabilir ' + devFlats + ' adet bağımsız bölüm projenin finansmanını büyük oranda karşılayacaktır.';

        // Rapor Çıktısı (HTML)
        reportContainer.innerHTML = `
            <div class="space-y-3 relative z-10 animate-fade-in">
                <div class="flex items-start gap-2 border-b border-[#262C36] pb-2">
                    <i class="fa-solid fa-chart-pie text-[#19C7B1] mt-0.5"></i>
                    <div>
                        <strong class="text-white text-xs block">İmar ve Kapasite Analizi</strong>
                        <span>${aiComment} Toplam ${totalFlats} bağımsız bölüm üretimi hedeflenmiştir.</span>
                    </div>
                </div>
                <div class="flex items-start gap-2 border-b border-[#262C36] pb-2">
                    <i class="fa-solid fa-sun text-amber-400 mt-0.5"></i>
                    <div>
                        <strong class="text-white text-xs block">Şerefiye ve Lokasyon Etkisi</strong>
                        <span>${serefComment}</span>
                    </div>
                </div>
                <div class="flex items-start gap-2 border-b border-[#262C36] pb-2">
                    <i class="fa-solid fa-coins text-[#F04491] mt-0.5"></i>
                    <div>
                        <strong class="text-white text-xs block">Finansal Risk Ön Görüsü</strong>
                        <span>${riskComment} Tahmini baz inşaat maliyeti: <strong>${costText}</strong>.</span>
                    </div>
                </div>
                <div class="pt-1">
                    <strong class="text-[#19C7B1] text-xs">PropTech Sistem Kararı:</strong> 
                    <span class="text-white font-medium">${(landShare <= 55 && emsal >= 1) ? 'YATIRIM YAPILABİLİR (Rasyonel)' : 'RİSKLİ YATIRIM (Marjlar Dar)'}</span>
                </div>
            </div>
        `;
    }, 1200); // 1.2 saniye bekleme efekti
};