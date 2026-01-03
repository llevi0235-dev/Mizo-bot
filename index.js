const { Client, LocalAuth } = require('whatsapp-web.js');
const admin = require('firebase-admin');
const cron = require('node-cron');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
  authDomain: "j-bo-a567a.firebaseapp.com",
  databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "j-bo-a567a",
  storageBucket: "j-bo-a567a.firebasestorage.app",
  messagingSenderId: "1029278826614",
  appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: firebaseConfig.databaseURL
});

const db = admin.firestore();

// Bot Configuration
const BOT_NUMBER = '919233137736';
const ADMIN_NUMBER = '919233137736';

const ROLES = {
  CITIZEN: 'citizen',
  THIEF: 'thief',
  POLICE: 'police',
  BUSINESSMAN: 'businessman'
};

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const activeUsers = new Map();

client.on('qr', (qr) => {
  console.log('QR Code received. Scan it with WhatsApp.');
});

client.on('ready', () => {
  console.log('Bot is ready!');
  startAutoIncome();
});

// Helper Functions
function isAdmin(phoneNumber) {
  return phoneNumber === ADMIN_NUMBER;
}

function generateUniqueId(length) {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

async function getOrCreateUser(phoneNumber, name) {
  if (activeUsers.has(phoneNumber)) {
    return activeUsers.get(phoneNumber);
  }
  
  const userRef = db.collection('users').doc(phoneNumber);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    const userData = userDoc.data();
    activeUsers.set(phoneNumber, userData);
    return userData;
  }
  
  const newUser = {
    phoneNumber: phoneNumber,
    name: name,
    role: ROLES.CITIZEN,
    cash: 10000,
    id: generateUniqueId(3),
    casesSolved: 0,
    roleChanges: 0,
    lastRoleChange: null,
    inJail: false,
    jailEndTime: null,
    robbedTargets: [],
    bodyguard: null,
    employer: null,
    investments: [],
    investmentHistory: [],
    loan: null,
    banned: false,
    createdAt: Date.now()
  };
  
  await userRef.set(newUser);
  activeUsers.set(phoneNumber, newUser);
  
  return newUser;
}

async function updateUser(phoneNumber, updates) {
  const userRef = db.collection('users').doc(phoneNumber);
  await userRef.update(updates);
  
  if (activeUsers.has(phoneNumber)) {
    const user = activeUsers.get(phoneNumber);
    Object.assign(user, updates);
  }
}

async function getUniversalBank() {
  const bankRef = db.collection('system').doc('bank');
  const bankDoc = await bankRef.get();
  
  if (!bankDoc.exists) {
    await bankRef.set({ balance: 0 });
    return 0;
  }
  
  return bankDoc.data().balance || 0;
}

async function addToBank(amount) {
  const bankRef = db.collection('system').doc('bank');
  const currentBalance = await getUniversalBank();
  await bankRef.set({ balance: currentBalance + amount });
}

function formatCash(amount) {
  return amount.toLocaleString();
}

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return days + ' day' + (days > 1 ? 's' : '');
  if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '');
  return minutes + ' minute' + (minutes !== 1 ? 's' : '');
}

function maskId(id, role, hasBodyguard) {
  if (role === ROLES.CITIZEN || role === ROLES.THIEF) {
    return id.substring(0, 2) + '?';
  }
  
  if (role === ROLES.BUSINESSMAN) {
    if (hasBodyguard) {
      return id.substring(0, 2) + '????';
    } else {
      return id.substring(0, 3) + '???';
    }
  }
  
  return id;
}

function checkIdMatch(guessedId, actualId) {
  if (guessedId === actualId) return 'exact';
  
  const actualNum = parseInt(actualId);
  const guessedNum = parseInt(guessedId);
  const diff = Math.abs(guessedNum - actualNum);
  
  if (guessedNum > actualNum && diff <= 100) return 'close';
  if (diff <= 200) return 'somewhat';
  
  return 'wrong';
}

function startAutoIncome() {
  cron.schedule('* * * * *', async () => {
    try {
      const usersSnapshot = await db.collection('users').get();
      const now = Date.now();
      
      for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        const phoneNumber = doc.id;
        
        if (user.banned) continue;
        if (user.inJail && user.jailEndTime > now) continue;
        
        if (user.role === ROLES.CITIZEN) {
          if (!user.lastCitizenIncome || now - user.lastCitizenIncome >= 1800000) {
            await updateUser(phoneNumber, {
              cash: user.cash + 400,
              lastCitizenIncome: now
            });
          }
        }
        
        if (user.role === ROLES.POLICE) {
          if (!user.lastPoliceIncome || now - user.lastPoliceIncome >= 1800000) {
            await updateUser(phoneNumber, {
              cash: user.cash + 450,
              lastPoliceIncome: now
            });
          }
        }
        
        if (user.role === ROLES.THIEF) {
          if (!user.lastThiefIncome || now - user.lastThiefIncome >= 1200000) {
            await updateUser(phoneNumber, {
              cash: user.cash + 50,
              lastThiefIncome: now
            });
          }
        }
        
        if (user.role === ROLES.BUSINESSMAN) {
          if (!user.lastBusinessmanIncome || now - user.lastBusinessmanIncome >= 1800000) {
            await updateUser(phoneNumber, {
              cash: user.cash + 1000,
              lastBusinessmanIncome: now
            });
          }
        }
      }
    } catch (error) {
      console.error('Auto income error:', error);
    }
  });
}

// Message Handler
client.on('message', async (msg) => {
  try {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const phoneNumber = contact.number;
    const name = contact.pushname || contact.name || phoneNumber;
    const messageText = msg.body.trim();
    
    const user = await getOrCreateUser(phoneNumber, name);
    
    if (user.banned && !isAdmin(phoneNumber)) {
      await msg.reply('You are permanently banned from this game.');
      return;
    }
    
    if (user.inJail && user.jailEndTime) {
      if (Date.now() < user.jailEndTime) {
        if (messageText === '/jailtm') {
          const timeLeft = user.jailEndTime - Date.now();
          await msg.reply('JAIL STATUS\nLocation: Mizoram Central Jail\nTime Remaining: ' + formatTime(timeLeft) + '\n\nYou cannot rob or be arrested during this time.');
          return;
        }
        return;
      } else {
        await updateUser(phoneNumber, {
          inJail: false,
          jailEndTime: null,
          id: generateUniqueId(3)
        });
        user.inJail = false;
        user.jailEndTime = null;
      }
    }
    if (messageText === '/menu') {
      let menu = 'GAME MENU\n\n';
      menu += 'CITIZEN COMMANDS:\n';
      menu += '/crlps - Change to Police\n';
      menu += '/crltf - Change to Thief\n';
      menu += '/crlbs - Change to Businessman\n\n';
      menu += 'THIEF COMMANDS:\n';
      menu += '/scantarget - Scan targets (200 cash)\n';
      menu += '/scanps - Scan police (100 cash)\n';
      menu += '@user/rob[ID] - Rob target (100 cash)\n';
      menu += '/jailtm - Check jail time\n\n';
      menu += 'POLICE COMMANDS:\n';
      menu += '/scan - Scan thieves (200 cash)\n';
      menu += '@user/arrest[ID] - Arrest thief (50 cash)\n';
      menu += '/leave - Resign from bodyguard\n\n';
      menu += 'BUSINESSMAN COMMANDS:\n';
      menu += '/invest[amount] - Invest money\n\n';
      menu += 'GENERAL COMMANDS:\n';
      menu += '/menu - Show this menu\n';
      menu += '/status - Check your status\n';
      menu += '/ubank - Universal Bank balance\n';
      menu += '/toppolice - Top 50 police\n';
      menu += '/richestman - Top 50 richest';
      
      await msg.reply(menu);
      return;
    }
    
    if (messageText === '/status') {
      let statusMsg = 'YOUR STATUS\n\n';
      let displayRole = user.role;
      if (user.role === ROLES.THIEF && chat.isGroup) {
        displayRole = ROLES.CITIZEN;
      }
      
      statusMsg += 'Role: ' + displayRole + '\n';
      statusMsg += 'Wealth: ' + formatCash(user.cash) + ' cash';
      
      if (user.role === ROLES.POLICE) {
        statusMsg += '\nCases Solved: ' + user.casesSolved;
      }
      
      await msg.reply(statusMsg);
      return;
    }
    
    if (messageText === '/ubank') {
      const bankBalance = await getUniversalBank();
      await msg.reply('UNIVERSAL BANK\n\nTotal Balance: ' + formatCash(bankBalance) + ' cash');
      return;
    }
    
    if (messageText === '/crlps') {
      if (user.role === ROLES.POLICE) {
        await msg.reply('You are already a police!');
        return;
      }
      
      if (user.roleChanges >= 2 && !isAdmin(phoneNumber)) {
        const cooldownEnd = user.lastRoleChange + (2 * 24 * 60 * 60 * 1000);
        if (Date.now() < cooldownEnd) {
          const timeLeft = cooldownEnd - Date.now();
          await msg.reply('You have reached the maximum role changes (2). Please wait ' + formatTime(timeLeft) + ' before changing again.');
          return;
        } else {
          await updateUser(phoneNumber, { roleChanges: 0 });
          user.roleChanges = 0;
        }
      }
      
      await updateUser(phoneNumber, {
        role: ROLES.POLICE,
        roleChanges: user.roleChanges + 1,
        lastRoleChange: Date.now()
      });
      
      await msg.reply('Your role has been changed to police!');
      return;
    }
    
    if (messageText === '/crltf') {
      if (user.role === ROLES.THIEF) {
        await msg.reply('You are already a thief!');
        return;
      }
      
      if (user.roleChanges >= 2 && !isAdmin(phoneNumber)) {
        const cooldownEnd = user.lastRoleChange + (2 * 24 * 60 * 60 * 1000);
        if (Date.now() < cooldownEnd) {
          const timeLeft = cooldownEnd - Date.now();
          await msg.reply('You have reached the maximum role changes (2). Please wait ' + formatTime(timeLeft) + ' before changing again.');
          return;
        } else {
          await updateUser(phoneNumber, { roleChanges: 0 });
          user.roleChanges = 0;
        }
      }
      
      await updateUser(phoneNumber, {
        role: ROLES.THIEF,
        id: generateUniqueId(3),
        roleChanges: user.roleChanges + 1,
        lastRoleChange: Date.now()
      });
      
      await msg.reply('Your role has been changed to thief!');
      return;
    }
    
    if (messageText === '/crlbs') {
      if (user.role === ROLES.BUSINESSMAN) {
        await msg.reply('You are already a businessman!');
        return;
      }
      
      if (user.roleChanges >= 2 && !isAdmin(phoneNumber)) {
        const cooldownEnd = user.lastRoleChange + (2 * 24 * 60 * 60 * 1000);
        if (Date.now() < cooldownEnd) {
          const timeLeft = cooldownEnd - Date.now();
          await msg.reply('You have reached the maximum role changes (2). Please wait ' + formatTime(timeLeft) + ' before changing again.');
          return;
        } else {
          await updateUser(phoneNumber, { roleChanges: 0 });
          user.roleChanges = 0;
        }
      }
      
      let newCash = user.cash;
      if (!user.wasBusinessmanBefore) {
        newCash += 500000;
      }
      
      await updateUser(phoneNumber, {
        role: ROLES.BUSINESSMAN,
        cash: newCash,
        id: generateUniqueId(6),
        wasBusinessmanBefore: true,
        roleChanges: user.roleChanges + 1,
        lastRoleChange: Date.now()
      });
      
      await msg.reply('Your role has been changed to businessman!' + (!user.wasBusinessmanBefore ? '\nYou received 500,000 cash!' : ''));
      return;
    }
    
    if (messageText === '/scantarget') {
      if (user.role !== ROLES.THIEF) {
        await msg.reply('This command is only for thieves.');
        return;
      }
      
      if (!chat.isGroup) {
        await msg.reply('This command can only be used in groups.');
        return;
      }
      
      const cost = isAdmin(phoneNumber) ? 0 : 200;
      if (user.cash < cost) {
        await msg.reply('You dont have enough cash. Required: ' + cost + ' cash.');
        return;
      }
      
      if (cost > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost });
        await addToBank(cost);
      }
      
      const participants = chat.participants;
      let results = 'TARGET SCAN RESULTS\n\n';
      let foundAny = false;
      
      for (const participant of participants) {
        const targetNumber = participant.id.user;
        if (targetNumber === phoneNumber) continue;
        
        const targetDoc = await db.collection('users').doc(targetNumber).get();
        if (!targetDoc.exists) continue;
        
        const target = targetDoc.data();
        
        if (target.role === ROLES.CITIZEN) {
          foundAny = true;
          const maskedId = maskId(target.id, ROLES.CITIZEN);
          results += '@' + targetNumber + '\n';
          results += 'Role: Citizen\n';
          results += 'Wealth: ' + formatCash(target.cash) + ' cash\n';
          results += 'ID: ' + maskedId + '\n\n';
        }
        
        if (target.role === ROLES.BUSINESSMAN) {
          foundAny = true;
          const hasBodyguard = target.bodyguard ? true : false;
          const maskedId = maskId(target.id, ROLES.BUSINESSMAN, hasBodyguard);
          results += '@' + targetNumber + '\n';
          results += 'Role: Businessman\n';
          results += 'Wealth: ' + formatCash(target.cash) + ' cash\n';
          results += 'ID: ' + maskedId + '\n\n';
        }
      }
      
      if (!foundAny) {
        results = 'No targets found in this group.';
      }
      
      if (cost > 0) {
        results += '\n' + cost + ' cash deducted for scanning.';
      }
      
      await msg.reply(results);
      return;
    }
    
    if (messageText === '/scanps') {
      if (user.role !== ROLES.THIEF) {
        await msg.reply('This command is only for thieves.');
        return;
      }
      
      if (!chat.isGroup) {
        await msg.reply('This command can only be used in groups.');
        return;
      }
      
      const cost = isAdmin(phoneNumber) ? 0 : 100;
      if (user.cash < cost) {
        await msg.reply('You dont have enough cash. Required: ' + cost + ' cash.');
        return;
      }
      
      if (cost > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost });
        await addToBank(cost);
      }
      
      const participants = chat.participants;
      let results = 'POLICE SCAN RESULTS\n\n';
      let foundAny = false;
      
      for (const participant of participants) {
        const targetNumber = participant.id.user;
        const targetDoc = await db.collection('users').doc(targetNumber).get();
        if (!targetDoc.exists) continue;
        
        const target = targetDoc.data();
        
        if (target.role === ROLES.POLICE) {
          foundAny = true;
          results += '@' + targetNumber + '\n';
          results += 'Role: Police\n';
          results += 'Cases Solved: ' + target.casesSolved + '\n\n';
        }
      }
      
      if (!foundAny) {
        results = 'No police found in this group.';
      }
      
      if (cost > 0) {
        results += '\n' + cost + ' cash deducted for scanning.';
      }
      
      await msg.reply(results);
      return;
    }
    
    if (messageText.includes('/rob')) {
      if (user.role !== ROLES.THIEF) {
        await msg.reply('This command is only for thieves.');
        return;
      }
      
      const cost = isAdmin(phoneNumber) ? 0 : 100;
      if (user.cash < cost) {
        await msg.reply('You dont have enough cash. Required: ' + cost + ' cash.');
        return;
      }
      
      const match = messageText.match(/@(\d+)\/rob(\d+)/);
      if (!match) {
        await msg.reply('Invalid format. Use: @user/rob[ID]');
        return;
      }
      const targetNumber = match[1];
      const guessedId = match[2];
      
      if (targetNumber === phoneNumber) {
        await msg.reply('You cannot rob yourself!');
        return;
      }
      
      const robbedData = user.robbedTargets || [];
      const existingRob = robbedData.find(r => r.target === targetNumber);
      
      if (existingRob) {
        if (existingRob.success) {
          await msg.reply('You cannot rob the same person twice after a successful robbery.');
          return;
        }
        if (Date.now() - existingRob.time < 1800000) {
          const timeLeft = 1800000 - (Date.now() - existingRob.time);
          await msg.reply('You must wait ' + formatTime(timeLeft) + ' before robbing this person again.');
          return;
        }
      }
      
      const targetDoc = await db.collection('users').doc(targetNumber).get();
      if (!targetDoc.exists) {
        await msg.reply('Target not found.');
        return;
      }
      
      const target = targetDoc.data();
      
      if (target.role !== ROLES.CITIZEN && target.role !== ROLES.BUSINESSMAN) {
        await msg.reply('You can only rob citizens and businessmen.');
        return;
      }
      
      if (cost > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost });
        await addToBank(cost);
      }
      
      const matchType = checkIdMatch(guessedId, target.id);
      
      let reward = 0;
      let success = false;
      
      if (matchType === 'exact') {
        reward = Math.floor(target.cash * 0.10);
        success = true;
        await msg.reply('ROBBERY SUCCESS!\n\nPerfect ID match! You got 10%\nYou robbed @' + targetNumber + ' and got ' + formatCash(reward) + ' cash!');
      } else if (matchType === 'close') {
        reward = Math.floor(target.cash * 0.02);
        success = true;
        await msg.reply('ROBBERY SUCCESS!\n\nClose ID match! You got 2%\nYou robbed @' + targetNumber + ' and got ' + formatCash(reward) + ' cash!');
      } else if (matchType === 'somewhat') {
        reward = Math.floor(target.cash * 0.01);
        success = true;
        await msg.reply('ROBBERY SUCCESS!\n\nSomewhat close! You got 1%\nYou robbed @' + targetNumber + ' and got ' + formatCash(reward) + ' cash!');
      } else {
        await msg.reply('Robbery failed! ID guess was incorrect.');
      }
      
      if (success && reward > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost + reward });
        await updateUser(targetNumber, { cash: target.cash - reward });
        
        if (target.role === ROLES.BUSINESSMAN) {
          await updateUser(targetNumber, { id: generateUniqueId(6) });
        }
      }
      
      const updatedRobbedTargets = robbedData.filter(r => r.target !== targetNumber);
      updatedRobbedTargets.push({
        target: targetNumber,
        time: Date.now(),
        success: success
      });
      
      await updateUser(phoneNumber, { robbedTargets: updatedRobbedTargets });
      return;
    }
    
    if (messageText === '/scan') {
      if (user.role !== ROLES.POLICE) {
        await msg.reply('This command is only for police.');
        return;
      }
      
      if (!chat.isGroup) {
        await msg.reply('This command can only be used in groups.');
        return;
      }
      
      const cost = isAdmin(phoneNumber) ? 0 : 200;
      if (user.cash < cost) {
        await msg.reply('You dont have enough cash. Required: ' + cost + ' cash.');
        return;
      }
      
      if (cost > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost });
        await addToBank(cost);
      }
      
      const participants = chat.participants;
      let results = 'THIEF SCAN RESULTS\n\n';
      let foundAny = false;
      
      for (const participant of participants) {
        const targetNumber = participant.id.user;
        const targetDoc = await db.collection('users').doc(targetNumber).get();
        if (!targetDoc.exists) continue;
        
        const target = targetDoc.data();
        
        if (target.role === ROLES.THIEF) {
          foundAny = true;
          const reward = Math.floor(target.cash * 0.03);
          const maskedId = maskId(target.id, ROLES.THIEF, false);
          results += '@' + targetNumber + '\n';
          results += 'Role: Thief\n';
          results += 'Reward: ' + formatCash(reward) + ' cash\n';
          results += 'ID: ' + maskedId + '\n\n';
        }
      }
      
      if (!foundAny) {
        results = 'No thieves found in this group.';
      }
      
      if (cost > 0) {
        results += '\n' + cost + ' cash deducted for scanning.';
      }
      
      await msg.reply(results);
      return;
    }
    
    if (messageText.includes('/arrest')) {
      if (user.role !== ROLES.POLICE) {
        await msg.reply('This command is only for police.');
        return;
      }
      
      const cost = isAdmin(phoneNumber) ? 0 : 50;
      if (user.cash < cost) {
        await msg.reply('You dont have enough cash. Required: ' + cost + ' cash.');
        return;
      }
      
      const match = messageText.match(/@(\d+)\/arrest(\d+)/);
      if (!match) {
        await msg.reply('Invalid format. Use: @user/arrest[ID]');
        return;
      }
      
      const targetNumber = match[1];
      const guessedId = match[2];
      
      if (targetNumber === phoneNumber) {
        await msg.reply('You cannot arrest yourself!');
        return;
      }
      
      const targetDoc = await db.collection('users').doc(targetNumber).get();
      if (!targetDoc.exists) {
        await msg.reply('Target not found.');
        return;
      }
      
      const target = targetDoc.data();
      
      if (target.role !== ROLES.THIEF) {
        await msg.reply('This person is not a thief.');
        return;
      }
      
      if (cost > 0) {
        await updateUser(phoneNumber, { cash: user.cash - cost });
        await addToBank(cost);
      }
      
      if (guessedId === target.id) {
        const thiefLoss = Math.floor(target.cash * 0.80);
        const policeReward = Math.floor(target.cash * 0.03);
        const bankAmount = Math.floor(target.cash * 0.77);
        
        await updateUser(phoneNumber, {
          cash: user.cash - cost + policeReward,
          casesSolved: user.casesSolved + 1
        });
        
        await updateUser(targetNumber, {
          cash: target.cash - thiefLoss,
          inJail: true,
          jailEndTime: Date.now() + 300000,
          id: generateUniqueId(3)
        });
        
        await addToBank(bankAmount);
        
        await msg.reply('ARREST SUCCESSFUL!\n\nYou arrested @' + targetNumber + '!\nReward: ' + formatCash(policeReward) + ' cash\nCase Solved +1');
        await msg.reply('@' + targetNumber + ' has been sent to Mizoram Central Jail for 5 minutes.');
        
      } else {
        await msg.reply('Arrest failed! ID guess was incorrect.');
      }
      
      return;
    }
    
    if (messageText.startsWith('/invest')) {
      if (user.role !== ROLES.BUSINESSMAN) {
        await msg.reply('This command is only for businessmen.');
        return;
      }
      
      const amount = parseInt(messageText.replace('/invest', ''));
      
      if (isNaN(amount) || amount <= 0) {
        await msg.reply('Invalid investment amount.');
        return;
      }
      
      if (user.cash < amount) {
        await msg.reply('You dont have enough cash.');
        return;
      }
      
      await updateUser(phoneNumber, { cash: user.cash - amount });
      
      if (isAdmin(phoneNumber)) {
        const rand = Math.random();
        
        if (rand < 0.4) {
          const multiplier = Math.floor(Math.random() * 5) + 1;
          const profit = amount * multiplier;
          await updateUser(phoneNumber, { cash: user.cash - amount + amount + profit });
          await msg.reply('Admin privilege: Investment result is instant!\n\nINVESTMENT SUCCESS!\nInvested: ' + formatCash(amount) + ' cash\nProfit: ' + formatCash(profit) + ' cash (' + multiplier + 'X)\nTotal Return: ' + formatCash(amount + profit) + ' cash');
        } else {
          const lossPercent = Math.floor(Math.random() * 100) + 1;
          const loss = Math.floor(amount * (lossPercent / 100));
          await addToBank(loss);
          await updateUser(phoneNumber, { cash: user.cash - amount + (amount - loss) });
          await msg.reply('Admin privilege: Investment result is instant!\n\nINVESTMENT FAILED\nInvested: ' + formatCash(amount) + ' cash\nLoss: ' + formatCash(loss) + ' cash (' + lossPercent + '%)\nRemaining: ' + formatCash(amount - loss) + ' cash');
        }
      } else {
        await msg.reply('INVESTMENT STARTED\n\nAmount: ' + formatCash(amount) + ' cash\nDuration: 30 minutes\n\nWait for results...');
        
        setTimeout(async () => {
          const currentUser = await getOrCreateUser(phoneNumber, name);
          const rand = Math.random();
          
          if (rand < 0.4) {
            const multiplier = Math.floor(Math.random() * 5) + 1;
            const profit = amount * multiplier;
            await updateUser(phoneNumber, { cash: currentUser.cash + amount + profit });
            
            await client.sendMessage(phoneNumber + '@c.us', 'INVESTMENT SUCCESS!\n\nInvested: ' + formatCash(amount) + ' cash\nProfit: ' + formatCash(profit) + ' cash (' + multiplier + 'X)\nTotal Return: ' + formatCash(amount + profit) + ' cash');
          } else {
            const lossPercent = Math.floor(Math.random() * 100) + 1;
            const loss = Math.floor(amount * (lossPercent / 100));
            await addToBank(loss);
            await updateUser(phoneNumber, { cash: currentUser.cash + (amount - loss) });
            
            await client.sendMessage(phoneNumber + '@c.us', 'INVESTMENT FAILED\n\nInvested: ' + formatCash(amount) + ' cash\nLoss: ' + formatCash(loss) + ' cash (' + lossPercent + '%)\nRemaining: ' + formatCash(amount - loss) + ' cash');
          }
        }, 1800000);
      }
      
      return;
    }
    
    if (messageText === '/toppolice') {
      const snapshot = await db.collection('users').where('role', '==', ROLES.POLICE).orderBy('casesSolved', 'desc').limit(50).get();
      
      let results = 'TOP 50 POLICE\n\n';
      
      if (snapshot.empty) {
        results = 'No police found.';
      } else {
        let rank = 1;
        snapshot.forEach(doc => {
          const u = doc.data();
          results += rank + '. @' + doc.id + ' - Cases Solved: ' + u.casesSolved + '\n';
          rank++;
        });
      }
      
      await msg.reply(results);
      return;
    }
    
    if (messageText === '/richestman') {
      const snapshot = await db.collection('users').orderBy('cash', 'desc').limit(50).get();
      
      let results = 'TOP 50 RICHEST\n\n';
      
      if (snapshot.empty) {
        results = 'No players found.';
      } else {
        let rank = 1;
        snapshot.forEach(doc => {
          const u = doc.data();
          let displayRole = u.role === ROLES.THIEF ? ROLES.CITIZEN : u.role;
          results += rank + '. @' + doc.id + ' - ' + displayRole + ' - ' + formatCash(u.cash) + ' cash\n';
          rank++;
        });
      }
      
      await msg.reply(results);
      return;
    }
    
  } catch (error) {
    console.error('Error:', error);
    await msg.reply('An error occurred. Please try again.');
  }
});

client.initialize();