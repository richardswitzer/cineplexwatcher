// Proxy to the Cineplex theatrical API.
// The subscription key is public — embedded unobfuscated in the Cineplex
// production JS bundle. It is not a user credential and requires no rotation.
// Set CINEPLEX_API_KEY in Netlify environment variables to override.
const API_BASE = 'https://apis.cineplex.com/prod/cpx/theatrical/api';
const SUB_KEY  = process.env.CINEPLEX_API_KEY || 'dcdac5601d864addbc2675a2e96cb1f8';

exports.handler = async function (event) {
  const { filmId, theatreId, language = 'en' } = event.queryStringParameters || {};

  if (!filmId || !theatreId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'filmId and theatreId are required' }),
    };
  }

  const url =
    `${API_BASE}/v1/showtimes` +
    `?filmId=${encodeURIComponent(filmId)}` +
    `&theatreId=${encodeURIComponent(theatreId)}` +
    `&language=${encodeURIComponent(language)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': SUB_KEY,
        Origin: 'https://www.cineplex.com',
        Referer: 'https://www.cineplex.com/',
        'User-Agent': 'cineplex-showtime-watcher/1.0',
      },
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }) };
  }

  if (res.status === 429) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limited by Cineplex API' }) };
  }
  if (!res.ok) {
    return { statusCode: res.status, body: JSON.stringify({ error: `Cineplex API returned ${res.status}` }) };
  }

  const data = await res.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
};
