const WebSocket = require('ws');

const ws = new WebSocket('wss://api.aspire-vision.co.in/api/audio_talkback');

ws.on('open', function open() {
  console.log('connected');
  ws.send('test');
  setTimeout(() => ws.close(), 1000);
});

ws.on('error', function error(err) {
  console.error('Error:', err.message);
});

ws.on('unexpected-response', function(request, response) {
  console.log('Unexpected response:', response.statusCode);
  response.on('data', (chunk) => {
    console.log('Body:', chunk.toString());
  });
});

ws.on('close', function close(code, reason) {
  console.log('disconnected', code, reason.toString());
});
