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
    const res = await api.get('/services?limit=20');
    console.log('SERVICES_FOUND:', res.data.length);
    for (const item of res.data) {
      console.log(`SERVICE: id=${item.service.id}, name=${item.service.name}, type=${item.service.type}, repo=${item.service.repoSlug}`);
    }
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

run();
