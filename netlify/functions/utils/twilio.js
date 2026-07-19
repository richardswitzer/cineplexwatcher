const https = require('https');

async function sendSms(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    console.warn('Twilio env vars not set — SMS skipped');
    return;
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body }).toString();
  const auth   = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(params),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 400) {
          console.error('Twilio error', res.statusCode, text);
          reject(new Error(`Twilio ${res.statusCode}`));
        } else {
          resolve(JSON.parse(text));
        }
      });
    });
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

module.exports = { sendSms };
