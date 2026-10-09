const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';
const SERVICE_ID = 'srv-dan88k2jnfac73fnkqdg';

const api = axios.create({
  baseURL: 'https://api.render.com/v1',
  headers: {
    'Authorization': `Bearer ${RENDER_KEY}`,
    'Accept': 'application/json'
  }
});

async function run() {
  try {
    const res = await api.get(`/services/${SERVICE_ID}/deploys?limit=5`);
    console.log(`Found ${res.data.length} deploys:`);
    for (const d of res.data) {
      const dep = d.deploy || d;
      console.log(`- ID: ${dep.id}, Status: ${dep.status}, Commit: ${dep.commit?.id?.slice(0, 7) || 'N/A'}, Message: ${dep.commit?.message || 'N/A'}, CreatedAt: ${dep.createdAt}`);
    }
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

run();
