const http = require('http');

// Use Render's port or default to 8000
const port = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Sector 7 Bot & Firebase Database Running! 🚀'); // Changed text
});

function keepAlive() {
    server.listen(port, () => {
        console.log(`✅ Keep-Alive Server listening on port ${port}`);
    });
}

module.exports = keepAlive;
