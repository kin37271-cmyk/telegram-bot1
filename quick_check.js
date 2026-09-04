const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';

const api = axios.create({
  baseURL: 'https://api.render.com/v1',
  headers: {
    'Authorization': `Bearer ${RENDER_KEY}`,
    'Accept': 'application/json'
  }
});

async function checkRenderDeploys() {
  try {
    const res = await api.get('/services/srv-dadec4u7bikc73btdjm0/deploys?limit=2');
    console.log('LATEST_RENDER_DEPLOY:', res.data[0]?.deploy?.status, res.data[0]?.deploy?.id);
  } catch (e) {
    console.error(e.message);
  }
}

checkRenderDeploys();
