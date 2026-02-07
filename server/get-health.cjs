const http = require('http');

http.get('http://localhost:8787/api/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const health = JSON.parse(data);
        console.log(JSON.stringify(health, null, 2));
    });
}).on('error', (e) => console.error(e));
