const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8787/ws?symbols=BTCUSDT');

ws.on('open', () => {
    console.log('Connected to WS');
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'metrics' && msg.symbol === 'BTCUSDT') {
            console.log('Received metrics for BTCUSDT');
            const bids = msg.bids || [];
            const asks = msg.asks || [];
            console.log(`Bids count: ${bids.length}`);
            console.log(`Asks count: ${asks.length}`);

            if (bids.length > 0) {
                console.log('Sample Bid:', bids[0]);
            }
            if (asks.length > 0) {
                console.log('Sample Ask:', asks[0]);
            }

            if (bids.length > 0 && asks.length > 0) {
                console.log('SUCCESS: Orderbook data received');
                process.exit(0);
            } else {
                console.log('WARNING: Orderbook empty');
                // Don't exit yet, maybe next message has data
            }
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
});

ws.on('error', (err) => {
    console.error('WS Error:', err);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error('Timeout waiting for orderbook data');
    process.exit(1);
}, 10000);
