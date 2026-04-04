const { chromium } = require('playwright');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// 改成你的 ITS2 页面
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
      timezoneId: 'Australia/Sydney'
    });

    const page = await context.newPage();

    console.log('Loading page...');
    await page.goto(URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForSelector('#steam-hot-wrap', { timeout: 120000 });
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

    const pageData = await page.evaluate(() => {
      const provider =
        document.querySelector('#steamHotProviderLogo')?.alt?.replace(/\s*logo/i, '').trim() ||
        document.querySelector('#dailyHotTitle')?.textContent?.split('•')[0]?.trim() ||
        'HOT GAME';

      const games = Array.from(document.querySelectorAll('.steam-hot-name'))
        .map(el => el.textContent.trim())
        .filter(Boolean)
        .slice(0, 4);

      return { provider, games };
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

    const gamesText = pageData.games
      .map(g => `➡️ ${g}`)
      .join('\n');

    const ctas = [
      'CLICK NOW',
      'PLAY NOW',
      'JOIN & WIN NOW'
    ];

    const cta = ctas[Math.floor(Math.random() * ctas.length)];

    const caption = `
<b>🔥 INTENSITY2 • HOT GAME PICKS 🔥</b>
🎰 <b>${pageData.provider.toUpperCase()} FEATURED SLOTS</b>
━━━━━━━━━━━━━━
${gamesText}

💰 <b>Fast Payouts & Instant Deposit</b>  
⚡ Trusted by Australia Players  
🏆 Premium Gaming Experience  
━━━━━━━━━━━━━━
🌐 <a href="	https://intensity2aus.net/RFITS2TLG">${cta}</a>
🎯 <i>Play Smart • Win Big • Cash Out Fast</i>
`;

    console.log('Sending to Telegram...');

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('disable_web_page_preview', 'true');
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

    console.log('✅ ITS2 SENT SUCCESS');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
})();
