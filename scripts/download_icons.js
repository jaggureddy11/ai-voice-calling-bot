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

// Also re-download the first 4 just in case they are needed locally later, but save as SVG or PNG
fetchIcon('makemytrip', 'makemytrip.png');
fetchIcon('paytm money', 'paytm.png'); 
fetchIcon('ixigo trains', 'ixigo.png');
fetchIcon('zingbus', 'zingbus.png');
