const { chromium } = require('playwright');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// 🔥 改成你的页面
const URL = 'https://intensity2aus.net/hotgame';

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
      timezoneId: 'Australia/Sydney', // ⭐ 固定澳洲时间
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    });

    const page = await context.newPage();

    console.log('Loading page...');
    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    // 等区块出现
    await page.waitForSelector('#steam-hot-wrap', { timeout: 120000 });

    // 等 JS 渲染 + 图片
    await page.waitForTimeout(8000);

    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('#steam-hot-wrap img'));
      await Promise.all(
        imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return;
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 10000);
          });
        })
      );
    });

    await page.waitForTimeout(2000);

    // ✅ 抓 Provider + 游戏名
    const pageData = await page.evaluate(() => {
      const titleText = document.querySelector('#dailyHotTitle')?.textContent?.trim() || '';

      const provider =
        document.querySelector('#steamHotProviderLogo')?.alt?.replace(/\s*logo\s*/i, '').trim() ||
        titleText.split('•')[0]?.trim() ||
        'HOT GAME';

      const gameNames = Array.from(document.querySelectorAll('.steam-hot-name'))
        .map(el => el.textContent.trim())
        .filter(Boolean)
        .slice(0, 4);

      return { provider, gameNames };
    });

    console.log('Taking screenshot...');
    const card = await page.$('#steam-hot-wrap');

    if (!card) {
      throw new Error('Cannot find #steam-hot-wrap');
    }

    await card.screenshot({ path: 'hotgame.png' });

    await browser.close();

    if (!fs.existsSync('hotgame.png')) {
      throw new Error('Screenshot NOT created');
    }

    const provider = (pageData.provider || 'HOT GAME').toUpperCase();
    const games = pageData.gameNames || [];

    const gamesText = games.map(g => `➡️ ${g.name}`).join('\n');

    // 🔥 CTA随机（更真实）
    const ctas = [
      'CLICK NOW',
      'PLAY NOW',
      'JOIN & WIN NOW'
    ];

    const cta = ctas[Math.floor(Math.random() * ctas.length)];

    // 🔥 Telegram HTML caption
    const caption = `
<b>🔥 INTENSITY2 • HOT GAME PICKS 🔥</b>
🎰 <b>${provider} FEATURED SLOTS</b>
━━━━━━━━━━━━━━
${gamesText}

💰 <b>Fast Payouts & Instant Deposit</b>  
⚡ Trusted by Australia Players  
🏆 Premium Gaming Experience  

━━━━━━━━━━━━━━
🌐 <b>Join Now ➤ <a href=" ">CLICK NOW</a ></b>
🎯 <i>Play Smart • Win Big • Cash Out Fast</i>
`;

    console.log('Sending to Telegram...');

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML'); // ⭐ 关键
    form.append('photo', new Blob([fs.readFileSync('hotgame.png')]), 'hotgame.png');

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });

    const json = await res.json();

    console.log('Telegram response:', json);

    if (!json.ok) {
      throw new Error(JSON.stringify(json));
    }

    console.log('✅ SENT SUCCESSFULLY');

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
})();
