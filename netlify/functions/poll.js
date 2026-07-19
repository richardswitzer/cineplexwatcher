// Scheduled every 5 minutes.
// Reads all saved watches, checks Cineplex API for new sessions, sends SMS if found.

const { fetchParsed, extractSessions } = require('./utils/cineplex');
const { getAllWatches, patchWatch }     = require('./utils/supabase');
const { sendSms }                       = require('./utils/twilio');

exports.handler = async function () {
  let watches;
  try {
    watches = await getAllWatches();
  } catch (err) {
    console.error('poll: DB read error', err.message);
    return { statusCode: 500 };
  }

  if (!watches.length) {
    console.log('poll: no watches');
    return { statusCode: 200, body: 'no watches' };
  }

  // Group watches by film_id so we only fetch the Cineplex API once per film
  const byFilm = {};
  for (const w of watches) {
    if (!byFilm[w.film_id]) byFilm[w.film_id] = [];
    byFilm[w.film_id].push(w);
  }

  for (const [filmId, filmWatches] of Object.entries(byFilm)) {
    // Fetch all theatre data for this film in one API call
    let apiData;
    try {
      // Use first watched theatreId — API appears to return all theatres regardless
      apiData = await fetchParsed(filmId, filmWatches[0].theatre_ids[0]);
    } catch (err) {
      console.error(`poll: Cineplex fetch failed film=${filmId}:`, err.message);
      continue;
    }

    for (const watch of filmWatches) {
      const currentIds = new Set();
      for (const theatreId of watch.theatre_ids) {
        const sessions = extractSessions(apiData, filmId, theatreId);
        for (const s of sessions) currentIds.add(s.vistaSessionId);
      }

      const prevIds  = new Set(watch.last_seen_ids || []);
      const newIds   = [...currentIds].filter(id => !prevIds.has(id));

      if (newIds.length > 0) {
        console.log(`poll: ${newIds.length} new sessions for "${watch.film_name}" (user ${watch.user_id})`);
        if (watch.phone) {
          const theatreList = watch.theatre_names.join(' / ');
          const msg = `🎬 ${newIds.length} new ${watch.film_name} ${watch.format} showtime${newIds.length > 1 ? 's' : ''} posted at ${theatreList}! Book now: https://www.cineplex.com/`;
          try {
            await sendSms(watch.phone, msg);
          } catch (err) {
            console.error(`poll: SMS failed for user ${watch.user_id}:`, err.message);
          }
        }
      }

      // Always update last_seen_ids to current snapshot
      try {
        await patchWatch(watch.id, { last_seen_ids: [...currentIds] });
      } catch (err) {
        console.error(`poll: patch failed for watch ${watch.id}:`, err.message);
      }
    }
  }

  return { statusCode: 200, body: 'poll complete' };
};
