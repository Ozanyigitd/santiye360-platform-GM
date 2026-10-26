// harita.js - Harita, Parsel CBS ve Pin Yönetimi Modülü

let myMap = null;
let mapPinLayer = null;
let geoJsonLayer = null;
let currentMapLayerMode = 'street';
let streetLayer, satelliteLayer;
let activePinUnsubscribe = null; // Realtime dinleyiciyi hafızada tutmak için

function haritaBildirim(mesaj, tur = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(mesaj, tur);
    } else if (tur === 'error') {
        window.alert(mesaj);
    } else {
        console.info(mesaj);
    }
}

// Örnek GeoJSON Verisi (Ankara İncek - Temsili Parseller)
// Gerçek projede bunu TKGM WFS servisinden veya kendi veritabanından dinamik çekeceğiz.
const ornekParselGeoJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "ada": "1420",
                "parsel": "5",
                "alan": "2800",
                "emsal": "1.80",
                "durum": "Kat Karşılığı Görüşülüyor",
                "renk": "#F59E0B" // Turuncu
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [32.7045, 39.8455],
                        [32.7055, 39.8455],
                        [32.7052, 39.8445],
                        [32.7042, 39.8448],
                        [32.7045, 39.8455]
                    ]
                ]
            }
        },
        {
            "type": "Feature",
            "properties": {
                "ada": "1420",
                "parsel": "6",
                "alan": "1200",
                "emsal": "0.50",
                "durum": "Müstakil Villa İmarlı",
                "renk": "#3B82F6" // Mavi
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [32.7056, 39.8455],
                        [32.7065, 39.8455],
                        [32.7062, 39.8445],
                        [32.7053, 39.8445],
                        [32.7056, 39.8455]
                    ]
                ]
            }
        }
    ]
};

function haritaBaslat() {
    if (myMap !== null) return; // Zaten başladıysa tekrar başlatma

    if (!window.L) {
        console.error('Harita başlatılamadı: Leaflet (L) yüklenmemiş.');
        haritaBildirim('Harita kütüphanesi yüklenemedi. index.html içindeki Leaflet bağlantısını kontrol edin.', 'error');
        return;
    }

    const mapContainer = document.getElementById('gmCanliHaritaAlan');
    if (!mapContainer) return;

    // Ankara İncek Koordinatları ile başlat
    myMap = window.L.map('gmCanliHaritaAlan').setView([39.845, 32.705], 15);

    streetLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
    });
    
    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: 'Google Satellite',
        maxZoom: 20
    });

    streetLayer.addTo(myMap);
    
    mapPinLayer = window.L.layerGroup().addTo(myMap);

    // GeoJSON (Parsel) Katmanını Ekle
    cbsParselleriCiz();

    // Haritaya tıklanınca Pin Ekleme İşlemi
    myMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        const type = document.getElementById('mapPinTip')?.value || 'Genel İşaret';
        const color = document.getElementById('mapPinColor')?.value || '#19C7B1';
        const title = document.getElementById('mapPinBaslik')?.value || 'Yeni Lokasyon';
        const detail = document.getElementById('mapPinDetay')?.value || '';
        
        haritayaPinEkleCloud(lat, lng, type, color, title, detail);
    });

    // Harita başlatıldığında pinleri dinlemeye başla (Realtime)
    haritaPinleriniBuluttanDinle();

    // Leaflet map fix for hidden tabs
    setTimeout(() => { myMap.invalidateSize(); }, 300);
}

function haritaUcur(lat, lng, zoom = 14) {
    if (myMap) {
        myMap.flyTo([lat, lng], zoom);
    }
}

function haritaKatmanDegistir() {
    if (!myMap) return;
    const btn = document.getElementById('haritaKatmanBtn');
    
    if (currentMapLayerMode === 'street') {
        myMap.removeLayer(streetLayer);
        satelliteLayer.addTo(myMap);
        currentMapLayerMode = 'satellite';
        if(btn) btn.textContent = 'Sokak Görünümü';
    } else {
        myMap.removeLayer(satelliteLayer);
        streetLayer.addTo(myMap);
        currentMapLayerMode = 'street';
        if(btn) btn.textContent = 'Uydu Görünümü';
    }
}

// ---- CBS PARSEL İŞLEMLERİ (GEOJSON) ----

function cbsParselleriCiz() {
    if(geoJsonLayer) {
        myMap.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = window.L.geoJSON(ornekParselGeoJSON, {
        style: function (feature) {
            return {
                color: feature.properties.renk,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.3
            };
        },
        onEachFeature: function (feature, layer) {
            // Parsele tıklandığında açılacak popup
            const popupContent = `
                <div class="text-xs text-[#091311] min-w-[150px]">
                    <strong class="text-sm block mb-1">Ada: ${feature.properties.ada} / Parsel: ${feature.properties.parsel}</strong>
                    <div><strong>Alan:</strong> ${feature.properties.alan} m²</div>
                    <div><strong>Emsal:</strong> ${feature.properties.emsal}</div>
                    <div class="mt-1 pt-1 border-t border-gray-300 font-medium">${feature.properties.durum}</div>
                </div>
            `;
            layer.bindPopup(popupContent);
        }
    }).addTo(myMap);
}


// ---- FIREBASE REALTIME PİN İŞLEMLERİ ----

async function haritayaPinEkleCloud(lat, lng, type, color, title, detail) {
    if (!window.currentUser) {
        alert("Haritaya kayıt eklemek için giriş yapmalısınız.");
        return;
    }

    if (!window.firebase || typeof window.firebase.firestore !== 'function') {
        haritaBildirim('Firebase/Firestore yüklenmedi. Firebase kurulumunu ve script sırasını kontrol edin.', 'error');
        return;
    }

    // Seçili bir şantiye odası varsa odaya, yoksa genel (public) olarak kaydet
    const roomId = window.currentSiteRoom ? window.currentSiteRoom.id : "public";

    const pinData = {
        lat: lat,
        lng: lng,
        type: type,
        color: color,
        title: title,
        detail: detail,
        roomId: roomId,
        createdBy: window.currentUser.uid,
        creatorName: window.currentUserProfile?.displayName || "Kullanıcı",
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await window.firebase.firestore().collection("map_pins").add(pinData);
        haritaBildirim('Raptiye haritaya başarıyla kaydedildi.', 'success');
        // Formu temizle
        const baslikInput = document.getElementById('mapPinBaslik');
        const detayInput = document.getElementById('mapPinDetay');
        if (baslikInput) baslikInput.value = '';
        if (detayInput) detayInput.value = '';
    } catch (error) {
        console.error("Pin ekleme hatası:", error);
        haritaBildirim('Raptiye kaydedilemedi.', 'error');
    }
}

function haritaPinleriniBuluttanDinle() {
    if (!myMap || !mapPinLayer) return;

    const fb = window.firebase;
    if (!fb || typeof fb.firestore !== 'function') {
        console.error('Pinler yüklenemedi: Firebase/Firestore henüz yüklenmemiş.');
        haritaBildirim('Harita verileri yüklenemedi. Firebase bağlantısını kontrol edin.', 'error');
        return;
    }

    // Eğer daha önce bir dinleyici varsa iptal et
    if(activePinUnsubscribe) {
        activePinUnsubscribe();
    }

    const roomId = window.currentSiteRoom ? window.currentSiteRoom.id : "public";
    
    // Sadece aktif odaya ait pinleri dinle
    const pinsQuery = fb.firestore().collection("map_pins")
                        .where("roomId", "==", roomId)
                        .orderBy("createdAt", "desc");

    // ONSNAPSHOT: Gerçek zamanlı dinleme
    activePinUnsubscribe = pinsQuery.onSnapshot((snapshot) => {
        mapPinLayer.clearLayers(); // Önce haritadaki pinleri temizle
        const listKutu = document.getElementById('haritaPinListesiKutu');
        if(listKutu) listKutu.innerHTML = ''; // Sağdaki listeyi temizle

        if (snapshot.empty) {
            if(listKutu) listKutu.innerHTML = '<div class="text-xs text-[#8E98A8]">Henüz kayıtlı raptiye yok.</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            
            // Haritaya Pin Çiz
            haritadaPinCiz(id, data);
            
            // Sağdaki Listeye Ekle
            listeyePinEkle(id, data);
        });
    }, (error) => {
        console.error("Pinleri dinleme hatası:", error);
        // İndeks hatası (Composite Index) varsa konsola düşecektir.
    });
}

// Eski HTML butonları bu adı çağırıyor olabilir. İsim uyumluluğu için korunuyor.
function haritaPinleriniBuluttanCek() {
    if (!myMap) {
        haritaBaslat(); // Harita açılmamışsa başlatır; başlatma işlemi pin dinleyicisini de kurar.
        return;
    }

    // Harita zaten açıksa eski dinleyiciyi yenileyip aktif oda pinlerini tekrar dinle.
    haritaPinleriniBuluttanDinle();
    setTimeout(() => {
        if (myMap) myMap.invalidateSize();
    }, 100);
}

function haritadaPinCiz(id, data) {
    const markerHtml = `
        <div style="background-color: ${data.color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
    `;
    const customIcon = window.L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const isOwner = window.currentUser && data.createdBy === window.currentUser.uid;
    const deleteBtn = isOwner ? `<button onclick="haritaPinSilCloud('${id}')" class="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded w-full">Bu Raptiyeyi Sil</button>` : '';

    const popupContent = `
        <div class="text-xs text-[#091311] min-w-[150px]">
            <span style="color:${data.color}; font-weight:bold;">${data.type}</span>
            <div class="font-bold text-sm mt-1">${data.title}</div>
            <div class="mt-1">${data.detail}</div>
            <div class="text-[10px] text-gray-500 mt-2 border-t pt-1">Ekleyen: ${data.creatorName}</div>
            ${deleteBtn}
        </div>
    `;

    window.L.marker([data.lat, data.lng], {icon: customIcon})
     .bindPopup(popupContent)
     .addTo(mapPinLayer);
}

function listeyePinEkle(id, data) {
    const listKutu = document.getElementById('haritaPinListesiKutu');
    if(!listKutu) return;

    const isOwner = window.currentUser && data.createdBy === window.currentUser.uid;

    const html = `
        <div class="p-2 rounded-lg bg-[#1C222B] border border-[#262C36] flex items-center justify-between group">
            <div class="flex items-center gap-2 cursor-pointer flex-1" onclick="haritaUcur(${data.lat}, ${data.lng}, 16)">
                <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${data.color}"></div>
                <div class="overflow-hidden">
                    <div class="text-xs font-semibold text-white truncate">${data.title}</div>
                    <div class="text-[10px] text-[#A6B0BF] truncate">${data.type}</div>
                </div>
            </div>
            ${isOwner ? `<button type="button" onclick="haritaPinSilCloud('${id}')" class="text-[#8E98A8] hover:text-[#F04491] px-2"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
        </div>
    `;
    listKutu.insertAdjacentHTML('beforeend', html);
}

async function haritaPinSilCloud(docId) {
    if(!confirm("Bu raptiyeyi silmek istediğinize emin misiniz?")) return;

    try {
        await window.firebase.firestore().collection("map_pins").doc(docId).delete();
        haritaBildirim('Raptiye silindi.', 'success');
        // onSnapshot dinlediği için harita ve liste otomatik güncellenecek, tekrar çekmeye gerek yok!
    } catch(error) {
        console.error("Pin silme hatası:", error);
        haritaBildirim('Silinirken bir hata oluştu.', 'error');
    }
}

// index.html içindeki onclick ve diğer modüllerden çağrılabilmesi için global API.
Object.assign(window, {
    haritaBaslat,
    haritaUcur,
    haritaKatmanDegistir,
    cbsParselleriCiz,
    haritayaPinEkleCloud,
    haritaPinleriniBuluttanDinle,
    haritaPinleriniBuluttanCek,
    haritadaPinCiz,
    listeyePinEkle,
    haritaPinSilCloud
});