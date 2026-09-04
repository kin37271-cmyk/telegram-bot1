const axios = require('axios');

async function checkBranches() {
  try {
    const res = await axios.get('https://api.github.com/repos/kin37271-cmyk/telegram-bot1/branches', {
      headers: {
        'Authorization': 'Bearer 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',
        'User-Agent': 'NodeApp'
      }
    });
    console.log('BRANCHES:', res.data.map(b => b.name));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

checkBranches();
