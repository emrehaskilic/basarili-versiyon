const http = require('http');
const fs = require('fs');

http.get('http://localhost:8787/api/health', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        fs.writeFileSync('health-report.json', JSON.stringify(JSON.parse(data), null, 2));
        console.log('Written to health-report.json');
    });
});
