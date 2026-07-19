const { fetchParsed } = require('./utils/cineplex');

exports.handler = async function () {
  let data;
  try { data = await fetchParsed('37617', '7402'); }
  catch(e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }

  const arr = Array.isArray(data) ? data : Object.values(data);

  // List all theatres with their IDs
  const theatres = arr.map(t => ({ id: t.theatreId, name: t.theatre }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theatres),
  };
};
