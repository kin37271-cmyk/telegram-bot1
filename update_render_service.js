const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';

const api = axios.create({
  baseURL: 'https://api.render.com/v1',
  headers: {
    'Authorization': `Bearer ${RENDER_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function updateService() {
  try {
    const res = await api.patch('/services/srv-dadec4u7bikc73btdjm0', {
      serviceDetails: {
        env: 'node',
        envSpecificDetails: {
          buildCommand: 'npm install',
          startCommand: 'node index.js'
        }
      }
    });
    console.log('UPDATE SUCCESS:', res.data.serviceDetails);
  } catch (err) {
    console.error('UPDATE ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

updateService();
