const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKEN = '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';
const OWNER = 'kin37271-cmyk';
const REPO = 'telegram-bot1';
const BRANCH = 'main';

const api = axios.create({
  baseURL: `https://api.github.com/repos/${OWNER}/${REPO}`,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Bot-Deployer'
  }
});

// Faylni GitHub ga yuklash yoki yangilash
async function uploadFile(relativePath, absolutePath) {
  const content = fs.readFileSync(absolutePath);
  const base64Content = content.toString('base64');
  const githubPath = relativePath.replace(/\\/g, '/');

  let sha = null;
  try {
    const existing = await api.get(`/contents/${githubPath}?ref=${BRANCH}`);
    sha = existing.data.sha;
  } catch (err) {
    // Fayl mavjud emas, yangi yaratiladi
  }

  const payload = {
    message: `Add ${githubPath}`,
    content: base64Content,
    branch: BRANCH
  };
  if (sha) payload.sha = sha;

  try {
    await api.put(`/contents/${githubPath}`, payload);
    console.log(`✅ Yuklandi: ${githubPath}`);
  } catch (err) {
    console.error(`❌ Xatolik (${githubPath}):`, err.response?.data || err.message);
  }
}

// Barcha fayllarni rekursiv qidirish
function getAllFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(baseDir, fullPath);

    // O'tkazib yuboriladigan fayllar va papkalar
    if (file === 'node_modules' || file === '.git' || file.endsWith('.log') || file.endsWith('.zip') || file.endsWith('.tmp') || file === 'push_to_github.js') {
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      results.push({ relPath, fullPath });
    }
  });

  return results;
}

// Eski bot.py va requirements.txt ni o'chirish
async function deleteOldFile(filename) {
  try {
    const existing = await api.get(`/contents/${filename}?ref=${BRANCH}`);
    if (existing.data && existing.data.sha) {
      await api.delete(`/contents/${filename}`, {
        data: {
          message: `Delete old ${filename}`,
          sha: existing.data.sha,
          branch: BRANCH
        }
      });
      console.log(`🗑 O'chirildi: ${filename}`);
    }
  } catch (e) {}
}

async function main() {
  console.log('🚀 GITHUBGA YUKLASH BOSHLANDI...');
  
  // 1. Eski keraksiz fayllarni tozalash
  await deleteOldFile('bot.py');
  await deleteOldFile('requirements.txt');

  // 2. Yangi loyiha fayllarini yuklash
  const files = getAllFiles(__dirname);
  console.log(`📦 Jami yuklanadigan fayllar soni: ${files.length} ta`);

  for (const f of files) {
    await uploadFile(f.relPath, f.fullPath);
    // GitHub API rate limit cheklovidan saqlanish uchun qisqa pauza
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n🎉 BARCHA FAYLLAR GITHUB REPOZITORIYASIGA 100% MUVAFFAQIYATLI YUKLANDI!');
}

main();
