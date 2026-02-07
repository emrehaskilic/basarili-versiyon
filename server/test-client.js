/* eslint-disable */
// Connect to WS and subscribe to BTCUSDT
const WebSocket = require('ws');
console.log('Connecting...');
const client = new WebSocket('ws://localhost:8787/ws?symbols=BTCUSDT');

client.on('open', () => {
    console.log('Connected to WS');
});

client.on('message', (data) => {
    //   console.log('Message:', data.toString().substring(0, 50));
});

client.on('error', (err) => {
    console.error('WS Error:', err);
});

setInterval(() => { }, 100000);
