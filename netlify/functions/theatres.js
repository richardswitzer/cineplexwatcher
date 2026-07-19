// GET /.netlify/functions/theatres?filmId=37617
// Returns { theatres: [{theatreId, name, city}], formats: ['IMAX...', 'VIP', ...] }
// Theatres are filtered to Ontario (province === 'ON') and sorted by city then name.

const { fetchParsed, extractTheatres, extractFormats } = require('./utils/cineplex');

const FALLBACK_THEATRE_ID = '7402'; // Scotiabank Toronto — confirmed to return full dataset

// GTA theatre whitelist — sorted by proximity to downtown Toronto
const GTA_THEATRES = [
  { theatreId: '7402', name: 'Scotiabank Theatre Toronto' },
  { theatreId: '7130', name: 'Cineplex Cinemas Yonge-Dundas and VIP' },
  { theatreId: '7400', name: 'Cineplex Cinemas Yonge-Eglinton and VIP' },
  { theatreId: '7406', name: 'Cineplex Cinemas Yorkdale' },
  { theatreId: '7199', name: 'Cineplex Cinemas Varsity and VIP' },
  { theatreId: '7139', name: 'Cineplex VIP Cinemas Don Mills' },
  { theatreId: '7298', name: 'Cineplex Cinemas Empress Walk' },
  { theatreId: '7253', name: 'Cineplex Odeon Eglinton Town Centre' },
  { theatreId: '7115', name: 'Cineplex Cinemas Fairview Mall' },
  { theatreId: '7404', name: 'Cineplex Cinemas Scarborough' },
  { theatreId: '7240', name: 'Cineplex Odeon Morningside' },
  { theatreId: '7260', name: 'Cineplex Cinemas Queensway and VIP' },
  { theatreId: '7420', name: 'Cineplex Cinemas Mississauga Square One' },
  { theatreId: '7122', name: 'Cineplex Cinemas Courtney Park' },
  { theatreId: '7123', name: 'Cineplex Cinemas Winston Churchill & VIP' },
  { theatreId: '7313', name: 'Cineplex Junxion Erin Mills' },
  { theatreId: '7411', name: 'SilverCity Brampton Cinemas' },
  { theatreId: '7408', name: 'Cineplex Cinemas Vaughan' },
  { theatreId: '7405', name: 'SilverCity Richmond Hill Cinemas' },
  { theatreId: '7213', name: 'Cineplex Cinemas Markham and VIP' },
  { theatreId: '7312', name: 'Cineplex Cinemas Pickering and VIP' },
  { theatreId: '7248', name: 'Cineplex Odeon Ajax Cinemas' },
  { theatreId: '7273', name: 'Cineplex Cinemas Oakville and VIP' },
  { theatreId: '7413', name: 'SilverCity Burlington Cinemas' },
  { theatreId: '7407', name: 'SilverCity Newmarket Cinemas' },
  { theatreId: '7284', name: 'Cineplex Odeon Aurora Cinemas' },
  { theatreId: '7290', name: 'Cineplex Cinemas Hamilton Mountain' },
  { theatreId: '7415', name: 'Cineplex Cinemas Ancaster' },
];

exports.handler = async function (event) {
  const { filmId } = event.queryStringParameters || {};
  if (!filmId) return { statusCode: 400, body: JSON.stringify({ error: 'filmId required' }) };

  let data;
  try {
    data = await fetchParsed(filmId, FALLBACK_THEATRE_ID);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }

  // Only show GTA theatres that are actually showing this film
  const allTheatres  = extractTheatres(data);
  const showingIds   = new Set(allTheatres.map(t => t.theatreId));
  const theatres     = GTA_THEATRES.filter(t => showingIds.has(t.theatreId));
  const formats      = extractFormats(data);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
    body: JSON.stringify({ theatres, formats }),
  };
};
