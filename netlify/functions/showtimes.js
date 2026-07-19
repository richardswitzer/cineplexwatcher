const https  = require('https');
const zlib   = require('zlib');

const API_HOST = 'apis.cineplex.com';
const API_PATH = '/prod/cpx/theatrical/api/v1/showtimes';
const SUB_KEY  = process.env.CINEPLEX_API_KEY || 'dcdac5601d864addbc2675a2e96cb1f8';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'identity',
        'Ocp-Apim-Subscription-Key': SUB_KEY,
        Origin: 'https://www.cineplex.com',
        Referer: 'https://www.cineplex.com/',
        'User-Agent': 'cineplex-showtime-watcher/1.0',
      },
    }, res => {
      const encoding = res.headers['content-encoding'];
      let stream = res;
      if (encoding === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function (event) {
  const { filmId, theatreId, language = 'en' } = event.queryStringParameters || {};

  if (!filmId || !theatreId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'filmId and theatreId are required' }) };
  }

  const url =
    `https://${API_HOST}${API_PATH}` +
    `?filmId=${encodeURIComponent(filmId)}` +
    `&theatreId=${encodeURIComponent(theatreId)}` +
    `&language=${encodeURIComponent(language)}`;

  let res;
  try {
    res = await get(url);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }) };
  }

  if (res.status === 429) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limited by Cineplex API' }) };
  }
  if (res.status !== 200) {
    return { statusCode: res.status, body: JSON.stringify({ error: `Cineplex API returned ${res.status}` }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: res.body,
  };
};
