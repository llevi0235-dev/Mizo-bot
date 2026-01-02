// src/config.js
module.exports = {
  // Basic configuration
  PORT: process.env.PORT || 3000,
  
  // WhatsApp/chat bot settings
  SESSION_ID: process.env.SESSION_ID || 'default-session',
  
  // API settings
  API_KEY: process.env.API_KEY || '',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  
  // Feature toggles
  ENABLE_LOGGING: true,
  DEBUG_MODE: false
};