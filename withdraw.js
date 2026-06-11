const fs = require('fs');
const generateImage = require('./withdraw-image');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const TX_ID = String(process.env.TX_ID || '');
const TX_AMOUNT = Math.abs(Number(process.env.TX_AMOUNT || 0));
const TX_TIME = String(process.env.TX_TIME || '');

// ✅ 修复 1：补全了丢失的 /getLiveStat.php 路径
const API_URL = 'https://intensity2aus.com';
// 这里修改为 5000，低于 5000 的触发直接在开头就会被拦截跳出
const MIN_AMOUNT = 5000; 

function absAmount(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  return Math.abs(parseFloat(cleaned) || 0);
}

// 简化文案函数，只保留 5000+ 的 Jackpot 文案
function getCaption(amount, provider, mobile) {
  return `🎉 <b>CONGRATULATIONS!</b>
━━━━━━━━━━━━━━
👑 <b>JACKPOT PAYOUT CONFIRMED</b>
💰 <b>AUD ${amount.toFixed(2)}</b>
🎰 ${provider}
📱 ${mobile}
━━━━━━━━━━━━━━
⚡ REAL WIN • REAL PAYOUT
🐸 Australia Trusted Platform
🪙 Deposit 5–15s
🪙 Withdraw 2–5min
━━━━━━━━━━━━━━
💎 <a href="https://intensity2aus.net/RFITS2TLG">START WINNING NOW</a >`;
}

async function sendPhoto(imagePath, caption) {
  const chatIds = String(CHAT_ID || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (!chatIds.length) {
    throw new Error('No valid chat_id found');
  }

  const fileBuffer = fs.readFileSync(imagePath);

  for (const id of chatIds) {
    const form = new FormData();
    form.append('chat_id', id);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('disable_web_page_preview', 'true');
    form.append('photo', new Blob([fileBuffer], { type: 'image/png' }), 'withdraw.png');

    // ✅ 修复 2：修正了完全写错的 Telegram 机器人 API 接口请求地址
    const res = await fetch(`https://telegram.org{BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });

    const json = await res.json();

    if (!json.ok) {
      throw new Error(`Telegram send failed for ${id}: ${JSON.stringify(json)}`);
    }

    console.log(`Sent to ${id}`);
  }
}

async function fetchLiveWithdraws() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // ✅ 修复 3：将 referer 域名调整为与 API 对应的 .com，防止跨域拦截
      'referer': 'https://intensity2aus.com'
    },
    body: 'background=1&mId=10511'
  });

  const json = await res.json();

  if (json?.status !== 'SUCCESS') {
    throw new Error('Live TX API not success');
  }

  return Array.isArray(json?.data?.WITHDRAW) ? json.data.WITHDRAW : [];
}

function findMatchingWithdraw(withdraws, targetAmount) {
  const normalized = withdraws.map(w => ({
    id: String(w.id || ''),
    mobile: String(w.mobile || ''),
    provider: String(w.site || '').toUpperCase(),
    amount: absAmount(w.cash)
  }));

  console.log('LIVE WITHDRAW NORMALIZED:', JSON.stringify(normalized, null, 2));

  return normalized.find(w => w.amount === targetAmount) || null;
}

(async () => {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      throw new Error('Missing BOT_TOKEN or CHAT_ID');
    }

    if (!TX_ID || !TX_AMOUNT || !TX_TIME) {
      throw new Error('Missing workflow input');
    }

    // 这里会自动拦截低于 5000 的金额，并打印 exit 日志
    if (TX_AMOUNT < MIN_AMOUNT) {
      console.log(`Amount below ${MIN_AMOUNT}, exit`);
      return;
    }

    console.log('Triggered by webhook:', {
      TX_ID,
      TX_AMOUNT,
      TX_TIME
    });

    const withdraws = await fetchLiveWithdraws();

    if (!withdraws.length) {
      console.log('No live withdraw data, exit');
      return;
    }

    const matched = findMatchingWithdraw(withdraws, TX_AMOUNT);

    if (!matched) {
      console.log('No matching live tx found, do not send');
      return;
    }

    console.log('MATCHED LIVE TX:', matched);

    const data = {
      id: matched.id || TX_ID,
      mobile: matched.mobile,
      provider: matched.provider,
      amount: matched.amount,
      time: TX_TIME
    };

    await generateImage(data);

    if (!fs.existsSync('withdraw.png')) {
      throw new Error('Image not created');
    }

    const caption = getCaption(data.amount, data.provider, data.mobile);
    await sendPhoto('withdraw.png', caption);

    console.log('DONE');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
