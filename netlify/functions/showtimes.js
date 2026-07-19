const { fetchParsed, extractSessions } = require('./utils/cineplex');

exports.handler = async function (event) {
  const { filmId, theatreId, language = 'en' } = event.queryStringParameters || {};
  if (!filmId || !theatreId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'filmId and theatreId are required' }) };
  }

  let data;
  try {
    data = await fetchParsed(filmId, theatreId);
  } catch (err) {
    if (err.message.includes('429')) return { statusCode: 429, body: JSON.stringify({ error: 'Rate limited' }) };
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }

  const sessions = extractSessions(data, filmId, theatreId);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(sessions),
  };
};
