const { fetchParsed } = require('./utils/cineplex');

exports.handler = async function () {
  // Try with no filmId to see if API returns all films
  let data;
  try { data = await fetchParsed('', '7402'); }
  catch(e) { return { statusCode: 200, body: JSON.stringify({ error: e.message }) }; }

  const arr = Array.isArray(data) ? data : Object.values(data);
  // Find Scotiabank Toronto and list its movies
  const sbk = arr.find(t => String(t.theatreId) === '7402') || arr[0];
  const movies = new Map();
  for (const d of sbk?.dates || []) {
    for (const m of d.movies || []) {
      if (m.filmId && !movies.has(String(m.filmId))) {
        movies.set(String(m.filmId), { filmId: String(m.filmId), name: m.name || m.filmName || m.title, keys: Object.keys(m) });
      }
    }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalTheatres: arr.length, movies: [...movies.values()] }),
  };
};
