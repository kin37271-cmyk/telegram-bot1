const axios = require('axios');

async function checkCommits() {
  try {
    const res = await axios.get('https://api.github.com/repos/kin37271-cmyk/telegram-bot1/commits?per_page=3', {
      headers: {
        'Authorization': 'Bearer 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',
        'User-Agent': 'NodeApp'
      }
    });
    console.log('LATEST_COMMITS:');
    res.data.forEach(c => console.log(`- ${c.sha.slice(0,7)}: ${c.commit.message.split('\n')[0]} (${c.commit.committer.date})`));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

checkCommits();
