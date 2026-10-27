// js/resmigazete.js - Resmi Gazete verilerini ekrana yansıtma modülü

function resmiGazeteHaberleriniCek() {
    // HTML'deki haber listesinin geleceği kutuyu buluyoruz
    const listeKutusu = document.getElementById('resmiGazeteHaberleri');
    if (!listeKutusu) return; 

    const db = firebase.database();
    
    // Veritabanındaki santiye360_resmigazete klasörünü dinle (Sadece son 15 haberi getir)
    db.ref("santiye360_resmigazete").limitToLast(15).on("value", (snapshot) => {
        listeKutusu.innerHTML = ''; // Yükleniyor yazısını temizle

        if (!snapshot.exists()) {
            listeKutusu.innerHTML = '<div class="text-xs text-[#8E98A8] p-3 text-center">Henüz yeni bir karar/ilan düşmedi.</div>';
            return;
        }

        // Verileri en yeniden en eskiye sıralamak için diziye alıyoruz
        const haberler = [];
        snapshot.forEach((child) => {
            haberler.push(child.val());
        });
        haberler.reverse(); 

        // Her bir haberi HTML kartı olarak ekrana bas
        haberler.forEach(haber => {
            const html = `
                <a href="${haber.link}" target="_blank" class="block p-3 mb-2 rounded-lg bg-[#1C222B] border border-[#262C36] hover:border-[#19C7B1] transition-all group">
                    <div class="text-xs font-semibold text-gray-200 group-hover:text-[#19C7B1] line-clamp-2 leading-relaxed">
                        ${haber.title}
                    </div>
                    <div class="text-[10px] text-[#A6B0BF] mt-2 flex items-center">
                        <i class="fa-regular fa-clock mr-1"></i>
                        ${haber.pubDate || 'Yakın Zaman'}
                    </div>
                </a>
            `;
            listeKutusu.insertAdjacentHTML('beforeend', html);
        });
    });
}

// Uygulama açılıp Firebase hazır olduğunda fonksiyonu tetikle
document.addEventListener("DOMContentLoaded", () => {
    // Firebase'in kendini toparlaması için 1.5 saniye avans
    setTimeout(resmiGazeteHaberleriniCek, 1500); 
});