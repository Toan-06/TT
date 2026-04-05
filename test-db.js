require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing URI:', process.env.CHATBOT_MONGODB_URI);

const chatbotDb = mongoose.createConnection(process.env.CHATBOT_MONGODB_URI);

chatbotDb.on('connected', () => {
  console.log('✅ Connected to secondary MongoDB (Chatbot DB)');
  process.exit(0);
});

chatbotDb.on('error', (err) => {
  console.error('❌ Chatbot DB connection error:', err.message);
  process.exit(1);
});
