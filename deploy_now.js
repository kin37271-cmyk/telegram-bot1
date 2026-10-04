const axios = require('axios');

const RENDER_KEY = 'rnd_Ikh4v3CmmxPztHSU3AXPohdKnteT';

async function checkAndDeploy() {
  try {
    // 1. Check GitHub
    const gh = await axios.get('https://api.github.com/repos/kin37271-cmyk/telegram-bot1/contents', {
      headers: {
        'Authorization': 'Bearer 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',
        'User-Agent': 'NodeApp'
      }
    });
    console.log('GITHUB_FILES:', gh.data.map(f => f.name).join(', '));

    // 2. Trigger Deploy on Render
    const render = axios.create({
      baseURL: 'https://api.render.com/v1',
      headers: {
        'Authorization': `Bearer ${RENDER_KEY}`,
        'Accept': 'application/json'
      }
    });

    // Let's trigger deploy for srv-dan88k2jnfac73fnkqdg (telegram-bot-maker-live)
    const dep = await render.post('/services/srv-dan88k2jnfac73fnkqdg/deploys', {
      clearCache: 'clear'
    });
    console.log('RENDER_DEPLOY_TRIGGERED:', dep.data.id, dep.data.status);
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

checkAndDeploy();
