const fs = require('fs');
const https = require('https');
const path = require('path');

const fetchIcon = (term, filename) => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=1`;
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const parsed = JSON.parse(data);
            if (parsed.results && parsed.results.length > 0) {
                const imgUrl = parsed.results[0].artworkUrl512;
                https.get(imgUrl, (imgRes) => {
                    const filePath = path.join(__dirname, '../frontend/assets', filename);
                    const stream = fs.createWriteStream(filePath);
                    imgRes.pipe(stream);
                    stream.on('finish', () => console.log('Saved:', filename));
                });
            } else {
                console.log('No results for:', term);
            }
        });
    }).on('error', err => console.log('Error:', err.message));
};

fetchIcon('abhibus', 'abhibus.png');
fetchIcon('redbus', 'redbus.png');
fetchIcon('cleartrip', 'cleartrip.png');
fetchIcon('goibibo', 'goibibo.png');
