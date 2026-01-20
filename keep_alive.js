const http = require('http');

module.exports = () => {
    http.createServer((req, res) => {
        res.write('Sector 7 Modular Systems: Online 🚀');
        res.end();
    }).listen(8080);
    console.log("🌐 Keep-Alive Server is running on Port 8080");
};
