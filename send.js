const { chromium } = require('playwright');
const fs = require('fs');
const FormData = require('form-data');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = 'https://intensity2aus.net/test-test';

(async () => {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('Missing BOT_TOKEN or CHAT_ID');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1.25
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });

  await page.waitForSelector('#steam-hot-wrap', { timeout: 120000 });

  const card = await page.$('#steam-hot-wrap');
  if (!card) {
    throw new Error('Cannot find #steam-hot-wrap');
  }

  await card.screenshot({
    path: 'hotgame.png'
  });

  await browser.close();

  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('photo', fs.createReadStream('hotgame.png'));
  form.append('caption', 'Today Hot Games');

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error('Telegram send failed: ' + JSON.stringify(json));
  }

  console.log('Sent successfully');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
