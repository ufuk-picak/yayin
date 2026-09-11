const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Yalnızca istediğin AWS yayınına ait başlıklar
const awsHeaders = {
    'Accept': '*/*',
    'Origin': 'https://cdn-e7kolcqtxrcl3fx6ms36.cdn7x4k2.com',
    'Referer': 'https://cdn-e7kolcqtxrcl3fx6ms36.cdn7x4k2.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
    'X-Client-IP': '176.240.226.131',
    'X-Rand': 'a446v376zm',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua-mobile': '?1'
};

// --- HTML ARAYÜZÜ (Projeksiyonda açılacak ekran) ---
const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Projeksiyon Canlı Yayın</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        body { background-color: #000; color: white; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden;}
        .player-container { width: 100%; max-width: 1200px; }
        video { width: 100%; height: auto; outline: none; }
    </style>
</head>
<body>
    <div class="player-container">
        <video id="video-player" controls autoplay></video>
    </div>
    <script>
        var video = document.getElementById('video-player');
        // Yayın kaynağı olarak kendi sunucumuzu gösteriyoruz
        var streamUrl = '/stream/aws-kanal.m3u8';

        if (Hls.isSupported()) {
            var hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play();
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play();
            });
        }
    </script>
</body>
</html>
`;

// Projeksiyondan siteye girildiğinde HTML'i göster
app.get('/', (req, res) => {
    res.send(htmlContent);
});

// --- YAYINI ÇEKME VE PROXY İŞLEMLERİ ---
app.get('/stream/aws-kanal.m3u8', async (req, res) => {
    try {
        const url = 'https://7f421c4d6e1deacf78c3dad12cb7b7d0.fra11-awscdn-1.com/AR6ld0ACMhy9/200.m3u8';
        const response = await axios.get(url, { headers: awsHeaders, responseType: 'text' });
        
        const baseUrl = 'https://7f421c4d6e1deacf78c3dad12cb7b7d0.fra11-awscdn-1.com/AR6ld0ACMhy9/';
        const host = req.protocol + '://' + req.get('host');

        // M3U8 içindeki ts linklerini bizim sunucuya yönlendir
        const rewrittenM3u8 = response.data.split('\n').map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const absoluteUrl = trimmedLine.startsWith('http') ? trimmedLine : baseUrl + trimmedLine;
                return `${host}/ts-proxy?url=${encodeURIComponent(absoluteUrl)}`;
            }
            return line;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenM3u8);
    } catch (error) {
        console.error("M3U8 Hatası:", error.message);
        res.status(500).send('Yayın listesi alınamadı.');
    }
});

// --- VİDEO PARÇACIKLARI (TS) İÇİN PROXY ---
app.get('/ts-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL eksik.');

    try {
        // En önemli kısım: Oynatıcının atamadığı şifreleri biz atıyoruz
        const response = await axios.get(targetUrl, { headers: awsHeaders, responseType: 'stream' });
        res.setHeader('Content-Type', 'video/MP2T');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('TS dosyası alınamadı.');
    }
});

// Bulut sunucuları (Render) portu kendi atar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor!`);
});