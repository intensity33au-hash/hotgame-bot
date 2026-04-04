const { chromium } = require('playwright');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = 'https://intensity2aus.net/test-test'; // 改成你的页面

(async () => {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      throw new Error('Missing BOT_TOKEN or CHAT_ID');
    }

    console.log('Opening browser...');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 }
    });

    console.log('Loading page...');
    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForTimeout(8000);

    console.log('Taking screenshot...');
    await page.screenshot({
      path: 'hotgame.png',
      fullPage: true
    });

    await browser.close();

    if (!fs.existsSync('hotgame.png')) {
      throw new Error('Screenshot NOT created');
    }

    const size = fs.statSync('hotgame.png').size;
    console.log('Screenshot size:', size);

    if (size < 1000) {
      throw new Error('Screenshot file too small');
    }

    console.log('Preparing Telegram upload...');

    const fileBuffer = fs.readFileSync('hotgame.png');
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const form = new FormData();

    form.append('chat_id', CHAT_ID);
    form.append('caption', 'Today Hot Games');
    form.append('photo', blob, 'hotgame.png');

    console.log('Sending to Telegram...');

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });

    const json = await res.json();
    console.log('Telegram response:', json);

    if (!json.ok) {
      throw new Error('Telegram send failed: ' + JSON.stringify(json));
    }

    console.log('✅ SENT SUCCESSFULLY');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
})();
