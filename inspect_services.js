const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';

const api = axios.create({
  baseURL: 'https://api.render.com/v1',
  headers: {
    'Authorization': `Bearer ${RENDER_KEY}`,
    'Accept': 'application/json'
  }
});

async function run() {
  try {
    const s1 = await api.get('/services/srv-dadec4u7bikc73btdjm0');
    console.log('SERVICE 1 (telegram-bot1-1):', JSON.stringify(s1.data, null, 2));

    const s2 = await api.get('/services/srv-d9jhlqvavr4c73ci9520');
    console.log('SERVICE 2 (telegram-bot1):', JSON.stringify(s2.data, null, 2));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

run();
