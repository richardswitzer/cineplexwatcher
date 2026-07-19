const https = require('https');
const zlib  = require('zlib');

const API_HOST = 'apis.cineplex.com';
const API_PATH = '/prod/cpx/theatrical/api/v1/showtimes';
const SUB_KEY  = process.env.CINEPLEX_API_KEY || 'dcdac5601d864addbc2675a2e96cb1f8';

function getRaw(filmId, theatreId) {
  const params = new URLSearchParams({ theatreId, language: 'en' });
  if (filmId) params.set('filmId', filmId);
  const url = `https://${API_HOST}${API_PATH}?${params}`;
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
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, raw: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function decompress(raw, encoding) {
  return new Promise((resolve, reject) => {
    if (encoding === 'gzip')    zlib.gunzip(raw,  (e, b) => e ? reject(e) : resolve(b));
    else if (encoding === 'deflate') zlib.inflate(raw, (e, b) => e ? reject(e) : resolve(b));
    else resolve(raw);
  });
}

async function fetchParsed(filmId, theatreId) {
  const { status, headers, raw } = await getRaw(filmId || '', theatreId);
  if (status !== 200) throw new Error(`Cineplex API returned ${status}`);
  const enc = (headers['content-encoding'] || '').toLowerCase();
  let buf;
  try { buf = await decompress(raw, enc || 'gzip'); }
  catch (_) { try { buf = await decompress(raw, 'gzip'); } catch (__) { buf = raw; } }
  return JSON.parse(buf.toString('utf-8'));
}

// Returns flat session objects for one theatreId
function extractSessions(data, filmId, theatreId) {
  const arr = Array.isArray(data) ? data : Object.values(data);
  const sessions = [];
  for (const t of arr) {
    if (String(t.theatreId) !== String(theatreId)) continue;
    for (const d of t.dates || []) {
      for (const m of d.movies || []) {
        for (const exp of m.experiences || []) {
          const expName = (exp.experienceTypes || []).join(', ') || m.presentationType || '';
          for (const sess of exp.sessions || []) {
            sessions.push({
              vistaSessionId:       String(sess.vistaSessionId),
              showStartDateTime:    sess.showStartDateTime,
              experienceName:       expName,
              seatsRemaining:       sess.seatsRemaining,
              isSoldOut:            sess.isSoldOut,
              isBookable:           !!sess.isShowtimeEnabledOnline,
              ticketingRedesignUrl: sess.ticketingRedesignUrl || null,
            });
          }
        }
      }
    }
  }
  return sessions;
}

// Returns [{theatreId, name}] for all theatres showing the film
function extractTheatres(data) {
  const arr = Array.isArray(data) ? data : Object.values(data);
  const theatres = [];
  for (const t of arr) {
    if (t.theatreId && t.theatreName) {
      theatres.push({ theatreId: String(t.theatreId), name: t.theatreName });
    }
  }
  return theatres.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { fetchParsed, extractSessions, extractTheatres };
