require('dotenv').config();
const mongoose = require('mongoose');
const Knowledge = require('./models/Knowledge');
const chatbotDb = require('./models/dbChatbot');

async function debugSearch() {
  try {
    await new Promise(resolve => {
        if (chatbotDb.readyState === 1) resolve();
        else chatbotDb.once('open', resolve);
    });

    const userMessage = "WanderViệt là gì";
    console.log(`\n🔍 Đang debug tìm kiếm cho: "${userMessage}"`);

    // 1. Thử Text Search
    const textResults = await Knowledge.find(
      { $text: { $search: userMessage } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } });

    console.log(`\n--- Kết quả Text Search (${textResults.length}): ---`);
    textResults.forEach(r => {
      console.log(`- Q: ${r.question} | Score: ${r.score}`);
    });

    // 2. Thử Keywords Regex
    const keywords = userMessage.toLowerCase().split(' ').filter(w => w.length > 3);
    console.log(`\n--- Keywords extracted: ${JSON.stringify(keywords)} ---`);
    if (keywords.length > 0) {
      const regex = new RegExp(keywords.join('|'), 'i');
      const regexResults = await Knowledge.find({ question: { $regex: regex } });
      console.log(`\n--- Kết quả Regex Search (${regexResults.length}): ---`);
      regexResults.forEach(r => {
        console.log(`- Q: ${r.question}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugSearch();
