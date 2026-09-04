const axios = require('axios');

const TOKEN = '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';

async function testPut() {
  try {
    const res = await axios.put('https://api.github.com/repos/kin37271-cmyk/telegram-bot1/contents/test.txt', {
      message: 'test commit',
      content: Buffer.from('hello').toString('base64'),
      branch: 'main'
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'NodeApp',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    console.log('PUT SUCCESS:', res.data.content?.name);
  } catch (e) {
    console.log('PUT ERROR:', e.response?.status, e.response?.data);
  }
}

testPut();
