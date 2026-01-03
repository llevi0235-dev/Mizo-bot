// getSession.js - Get WhatsApp session using Puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');

async function getWhatsAppSession() {
    console.log("🚀 Starting WhatsApp Web session extraction...");
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Go to WhatsApp Web
    await page.goto('https://web.whatsapp.com');
    
    console.log("\n📱 INSTRUCTIONS:");
    console.log("1. Open WhatsApp on your phone");
    console.log("2. Tap Settings → Linked Devices → Link a Device");
    console.log("3. Scan the QR code on the screen");
    console.log("4. Wait for WhatsApp Web to load completely");
    console.log("5. After loading, press Enter in this terminal");
    
    // Wait for user to scan QR
    await page.waitForSelector('div[data-testid="conversation-list"]', { timeout: 300000 });
    
    console.log("\n✅ WhatsApp Web loaded successfully!");
    
    // Get session data
    const sessionData = await page.evaluate(() => {
        return {
            localStorage: Object.assign({}, window.localStorage),
            cookies: document.cookie
        };
    });
    
    // Save session data
    fs.writeFileSync('whatsapp-session.json', JSON.stringify(sessionData, null, 2));
    
    console.log("\n💾 Session saved to whatsapp-session.json!");
    console.log("📋 Copy this file content for use in your bot.");
    
    await browser.close();
    
    console.log("\n✅ Done! Use this session in your bot.");
}

getWhatsAppSession().catch(console.error);