const { chromium } = require('playwright');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = 'https://intensity2aus.net/test-test';

(async () => {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      throw new Error('Missing BOT_TOKEN or CHAT_ID');
    }

    console.log('Opening browser...');

    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1.25,
      timezoneId: 'Australia/Sydney',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log('Loading page...');
    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    // 先等主区块出现
    await page.waitForSelector('#steam-hot-wrap', { timeout: 120000 });

    // 再等页面脚本把内容渲染出来
    await page.waitForTimeout(8000);

    // 等区块内图片尽量加载完成
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('#steam-hot-wrap img'));
      await Promise.all(
        imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 10000);
          });
        })
      );
    });

    // 再补一点时间给重绘
    await page.waitForTimeout(2000);

    console.log('Taking screenshot...');
    const card = await page.$('#steam-hot-wrap');
    if (!card) {
      throw new Error('Cannot find #steam-hot-wrap');
    }

    await card.screenshot({
      path: 'hotgame.png'
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
