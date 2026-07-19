// GET /.netlify/functions/theatres?filmId=37617
// Returns { theatres: [{theatreId, name, city}], formats: ['IMAX...', 'VIP', ...] }
// Theatres are filtered to Ontario (province === 'ON') and sorted by city then name.

const { fetchParsed, extractTheatres, extractFormats } = require('./utils/cineplex');

const FALLBACK_THEATRE_ID = '7402'; // Scotiabank Toronto — confirmed to return full dataset

const GTA_ORDER = ['Toronto','Mississauga','Brampton','Vaughan','Richmond Hill',
  'Markham','Scarborough','North York','Etobicoke','Pickering','Ajax','Oakville',
  'Burlington','Hamilton','Oshawa','Whitby','Newmarket','Barrie'];

function cityOrder(city) {
  const i = GTA_ORDER.findIndex(c => city.includes(c));
  return i === -1 ? 99 : i;
}

exports.handler = async function (event) {
  const { filmId } = event.queryStringParameters || {};
  if (!filmId) return { statusCode: 400, body: JSON.stringify({ error: 'filmId required' }) };

  let data;
  try {
    data = await fetchParsed(filmId, FALLBACK_THEATRE_ID);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }

  const all      = extractTheatres(data);
  const formats  = extractFormats(data);

  // Filter to Ontario; fall back to all if none found (data may lack province)
  let theatres = all.filter(t => t.province === 'ON' || t.province === 'Ontario');
  if (theatres.length === 0) theatres = all;

  // Sort: GTA cities first, then alphabetical within each city
  theatres.sort((a, b) => {
    const oa = cityOrder(a.city || a.name);
    const ob = cityOrder(b.city || b.name);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
    body: JSON.stringify({ theatres, formats }),
  };
};
