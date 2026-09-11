const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// --- ORTAK FONKSİYONLAR ---

// M3U8 dosyasının içindeki .ts linklerini bizim proxy'e yönlendiren fonksiyon
function rewriteM3u8(m3u8Content, baseUrl) {
    return m3u8Content.split('\n').map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const absoluteUrl = trimmedLine.startsWith('http') ? trimmedLine : baseUrl + trimmedLine;
            // ZORUNLU DEĞİŞİKLİK: localhost yerine Render adresi girildi.
            return `https://yayin-pn82.onrender.com/ts-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        }
        return line;
    }).join('\n');
}

// Ana dizin
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- YAYIN 1: BATUTEST (İlk başardığımız) ---
const batutestHeaders = {
    'accept': '*/*',
    'origin': 'https://8602741.xyz',
    'referer': 'https://8602741.xyz/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
};

app.get('/stream/batutest.m3u8', async (req, res) => {
    try {
        const response = await axios.get('https://andro.evrenesoglu101.click/checklist/batutest.m3u8', {
            headers: batutestHeaders,
            responseType: 'text'
        });
        const baseUrl = 'https://andro.evrenesoglu101.click/checklist/';
        const rewrittenM3u8 = rewriteM3u8(response.data, baseUrl);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenM3u8);
    } catch (error) {
        res.status(500).send('Batutest m3u8 alınamadı.');
    }
});

// --- YAYIN 2: YENİ AWS CDN YAYINI ---
const awsHeaders = {
    'Accept': '*/*',
    'Origin': 'https://cdn-e7kolcqtxrcl3fx6ms36.cdn7x4k2.com',
    'Referer': 'https://cdn-e7kolcqtxrcl3fx6ms36.cdn7x4k2.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
    'X-Client-IP': '176.240.226.131', // Dinamik değişmesi gerekebilir, şimdilik sabit
    'X-Rand': 'a446v376zm',           // Bu token süreli olabilir, patlarsa güncellemek gerekir
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua-mobile': '?1'
};

app.get('/stream/yeni-kanal', async (req, res) => {
    try {
        const url = 'https://2bd627977520fd60ad5de19d2a6e22d9.fra9-awscdn-1.com/HcOEkH4IhAFj/200.m3u8';
        
        // M3U8 Dosyasını çek
        const response = await axios.get(url, {
            headers: awsHeaders,
            responseType: 'text'
        });
        
        // URL'nin sonundaki dosya adını atıp ana yolu (baseUrl) buluyoruz
        const baseUrl = 'https://2bd627977520fd60ad5de19d2a6e22d9.fra9-awscdn-1.com/HcOEkH4IhAFj/';
        
        const rewrittenM3u8 = rewriteM3u8(response.data, baseUrl);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenM3u8);
    } catch (error) {
        console.error("Yeni kanal m3u8 hatası:", error.message);
        res.status(500).send('Yeni kanal m3u8 alınamadı.');
    }
});

// --- ORTAK TS PROXY (Video Parçacıkları İçin) ---
app.get('/ts-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL eksik.');

    // URL'nin kime ait olduğunu bulup doğru başlıkları (headers) seçmemiz lazım
    let headersToUse = {};
    if (targetUrl.includes('evrenesoglu101.click')) {
        headersToUse = batutestHeaders;
    } else if (targetUrl.includes('fra9-awscdn-1.com')) {
        headersToUse = awsHeaders;
    } else {
        // Tanınmayan bir url gelirse boş gönder
        headersToUse = { 'User-Agent': 'Mozilla/5.0' }; 
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: headersToUse,
            responseType: 'stream'
        });
        res.setHeader('Content-Type', 'video/MP2T');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('TS dosyası alınamadı.');
    }
});

// ZORUNLU DEĞİŞİKLİK: Bulut sunucuları (Render) portu kendi atar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy sunucusu çalışıyor: port ${PORT}`);
});