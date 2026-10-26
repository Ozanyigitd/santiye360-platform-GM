const { app, BrowserWindow, nativeImage } = require('electron');

function createWindow() {
  // Harici .ico dosyasına ihtiyaç duymadan gömülü ŞANTİYE360 altın ikon oluşturucu
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="22" fill="#0f172a"/>
    <path d="M50 18 C28 18 15 36 15 58 L85 58 C85 36 72 18 50 18 Z" fill="#f59e0b"/>
    <rect x="10" y="58" width="80" height="12" rx="6" fill="#d97706"/>
  </svg>`;
  const iconDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgIcon).toString('base64')}`;

  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: '#05080f',
    icon: nativeImage.createFromDataURL(iconDataUrl),
    autoHideMenuBar: true,
    title: 'ŞANTİYE360 v3.0 | Sosyal Gayrimenkul & Saha Komuta Merkezi',
    webPreferences: {
      nodeIntegration: false,     // Uygulama içindeki web sayfasının bilgisayar dosyalarına erişimini kapatır.
      contextIsolation: true,     // İnternetten gelen kodlarla (XSS) sistem kodlarını birbirinden yalıtır.
      sandbox: true               // Ekstra bir güvenlik katmanı ekler.
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});