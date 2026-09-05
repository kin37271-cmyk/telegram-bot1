const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';
const SERVICE_ID = 'srv-dadec4u7bikc73btdjm0';

const api = axios.create({
  baseURL: 'https://api.render.com/v1',
  headers: {
    'Authorization': `Bearer ${RENDER_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function upgrade() {
  try {
    // Check current service
    const s = await api.get(`/services/${SERVICE_ID}`);
    console.log('CURRENT_PLAN:', s.data.serviceDetails?.plan);

    // Try updating plan to starter
    const res = await api.patch(`/services/${SERVICE_ID}`, {
      serviceDetails: {
        plan: 'starter'
      }
    });
    console.log('NEW_PLAN:', res.data.serviceDetails?.plan);
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

upgrade();
