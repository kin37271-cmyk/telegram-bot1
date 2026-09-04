const axios = require('axios');

const TOKEN = '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';

async function testGitDb() {
  try {
    const res = await axios.post('https://api.github.com/repos/kin37271-cmyk/telegram-bot1/git/blobs', {
      content: 'hello world',
      encoding: 'utf-8'
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'NodeApp',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    console.log('BLOB SUCCESS:', res.data.sha);
  } catch (e) {
    console.log('BLOB ERROR:', e.response?.status, e.response?.data);
  }
}

testGitDb();
