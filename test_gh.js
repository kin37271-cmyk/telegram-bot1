const axios = require('axios');

const TOKEN = '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';

async function test() {
  try {
    const res = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'NodeApp'
      }
    });
    console.log('GitHub User:', res.data.login);
  } catch (e) {
    console.log('User check error:', e.response?.status, e.response?.data);
  }

  try {
    const res2 = await axios.get('https://api.github.com/repos/kin37271-cmyk/telegram-bot1', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'NodeApp'
      }
    });
    console.log('Repo permissions:', res2.data.permissions);
  } catch (e) {
    console.log('Repo check error:', e.response?.status, e.response?.data);
  }
}

test();
