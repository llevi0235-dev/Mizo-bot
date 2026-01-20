const { initializeApp } = require('firebase/app');
const { getDatabase } = require('firebase/database');
const Config = require('./config');

const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

module.exports = db;
