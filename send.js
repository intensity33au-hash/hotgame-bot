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

await page.route('https://cdn.vpower12.com/manage/game-icon/**', async route => {
  try {
    const url = route.request().url();
    console.log('Proxying VPOWER image:', url);

    const res = await fetch(url, {
      headers: {
        'referer': 'https://ufo9.asia/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.log('VPOWER proxy fetch failed:', res.status, url);
      return route.abort();
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await route.fulfill({
      status: 200,
      contentType: res.headers.get('content-type') || 'image/png',
      body: buffer
    });
  } catch (err) {
    console.log('VPOWER route error:', err.message);
    await route.abort();
  }
});

console.log('Loading page...');

await page.goto(URL, {
  waitUntil: 'networkidle',
  timeout: 120000
});

await page.waitForSelector('#steam-hot-wrap', {
  timeout: 120000
});

await page.waitForFunction(() => {
  const wrap = document.querySelector('#steam-hot-wrap');
  if (!wrap) return false;

  const cards = wrap.querySelectorAll('.steam-hot-card');
  const names = wrap.querySelectorAll('.steam-hot-name');

  return cards.length > 0 && names.length > 0;
}, {
  timeout: 120000
});

await page.evaluate(async () => {
  const imgs = Array.from(document.querySelectorAll('#steam-hot-wrap img'));

  await Promise.all(
    imgs.map(img => {
      return new Promise(resolve => {
        const finish = () => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
          } else {
            setTimeout(resolve, 3000);
          }
        };

        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }

        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
        setTimeout(finish, 12000);
      });
    })
  );
});

await page.waitForTimeout(2500);

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
🌐 <a href="https://intensity2aus.net/RFITS2TLG">${cta}</a>
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
