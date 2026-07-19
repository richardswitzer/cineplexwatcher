// GET /.netlify/functions/theatres?filmId=37617
// Returns [{theatreId, name}] for all theatres showing the film

const { fetchParsed, extractTheatres } = require('./utils/cineplex');

const FALLBACK_THEATRE_ID = '7402'; // Scotiabank Toronto — confirmed to return full dataset

exports.handler = async function (event) {
  const { filmId } = event.queryStringParameters || {};
  if (!filmId) return { statusCode: 400, body: JSON.stringify({ error: 'filmId required' }) };

  let data;
  try {
    data = await fetchParsed(filmId, FALLBACK_THEATRE_ID);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }

  const theatres = extractTheatres(data);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
    body: JSON.stringify(theatres),
  };
};
