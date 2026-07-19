const https  = require('https');
const zlib   = require('zlib');

const API_HOST = 'apis.cineplex.com';
const API_PATH = '/prod/cpx/theatrical/api/v1/showtimes';
const SUB_KEY  = process.env.CINEPLEX_API_KEY || 'dcdac5601d864addbc2675a2e96cb1f8';

function getRaw(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Ocp-Apim-Subscription-Key': SUB_KEY,
        Origin: 'https://www.cineplex.com',
        Referer: 'https://www.cineplex.com/',
        'User-Agent': 'Mozilla/5.0 cineplex-showtime-watcher/1.0',
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, raw: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function decompress(raw, encoding) {
  return new Promise((resolve, reject) => {
    if (encoding === 'gzip') {
      zlib.gunzip(raw, (err, buf) => err ? reject(err) : resolve(buf));
    } else if (encoding === 'deflate') {
      zlib.inflate(raw, (err, buf) => err ? reject(err) : resolve(buf));
    } else {
      resolve(raw);
    }
  });
}

// Slim down the Cineplex response to just what the UI needs.
// Returns an array of flat session objects for the requested theatre/film.
function extractSessions(data, filmId, theatreId) {
  const arr = Array.isArray(data) ? data : Object.values(data);
  const sessions = [];
  for (const theatreEntry of arr) {
    if (String(theatreEntry.theatreId) !== String(theatreId)) continue;
    for (const dateEntry of theatreEntry.dates || []) {
      for (const movie of dateEntry.movies || []) {
        if (String(movie.filmId) !== String(filmId) && String(movie.id) !== String(filmId)) continue;
        for (const exp of movie.experiences || []) {
          const expName = (exp.experienceTypes || []).join(', ') || movie.presentationType || '';
          for (const sess of exp.sessions || []) {
            sessions.push({
              vistaSessionId:    sess.vistaSessionId,
              showStartDateTime: sess.showStartDateTime,
              experienceName:    expName,
              seatsRemaining:    sess.seatsRemaining,
              isSoldOut:         sess.isSoldOut,
              isBookable:        sess.isShowtimeEnabledOnline,
              ticketingRedesignUrl: sess.ticketingRedesignUrl || null,
            });
          }
        }
      }
    }
  }
  return sessions;
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

  let raw, headers, status;
  try {
    ({ raw, headers, status } = await getRaw(url));
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }) };
  }

  if (status === 429) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limited by Cineplex API' }) };
  if (status !== 200) return { statusCode: status, body: JSON.stringify({ error: `Cineplex API returned ${status}` }) };

  const encoding = (headers['content-encoding'] || '').toLowerCase();
  let body;
  try {
    const buf = await decompress(raw, encoding || 'gzip');
    body = buf.toString('utf-8');
  } catch (_) {
    try {
      const buf = await decompress(raw, 'gzip');
      body = buf.toString('utf-8');
    } catch (__) {
      body = raw.toString('utf-8');
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Invalid JSON from Cineplex API', sample: body.slice(0, 200) }) };
  }

  const sessions = extractSessions(parsed, filmId, theatreId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(sessions),
  };
};
