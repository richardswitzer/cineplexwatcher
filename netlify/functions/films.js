// GET /.netlify/functions/films
// Returns [{filmId, name}] of currently-showing films.
// Calls Cineplex API without filmId to get all films at a reference theatre.

const { fetchParsed } = require('./utils/cineplex');

const REFERENCE_THEATRE = '7402'; // Scotiabank Theatre Toronto

const FALLBACK_FILMS = [
  { filmId: '37617', name: 'The Odyssey' },
  { filmId: '38200', name: 'Jurassic World Rebirth' },
  { filmId: '38100', name: 'Superman: Legacy' },
];

exports.handler = async function () {
  let data;
  try {
    data = await fetchParsed('', REFERENCE_THEATRE);
  } catch (_) {
    return respond(FALLBACK_FILMS);
  }

  const films = new Map();
  const arr = Array.isArray(data) ? data : Object.values(data);
  for (const theatre of arr) {
    for (const dateEntry of theatre.dates || []) {
      for (const movie of dateEntry.movies || []) {
        if (movie.filmId && movie.name && !films.has(String(movie.filmId))) {
          films.set(String(movie.filmId), movie.name);
        }
      }
    }
  }

  const result = [...films.entries()]
    .map(([filmId, name]) => ({ filmId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return respond(result.length > 0 ? result : FALLBACK_FILMS);
};

function respond(films) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=1800' },
    body: JSON.stringify(films),
  };
}
