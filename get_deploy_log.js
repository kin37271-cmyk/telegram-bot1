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
    const res = await api.get('/services/srv-dadec4u7bikc73btdjm0/deploys/dep-dadec5e7bikc73btdk60');
    console.log('DEPLOY STATUS:', res.data.status);
    console.log('DETAILS:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

run();
