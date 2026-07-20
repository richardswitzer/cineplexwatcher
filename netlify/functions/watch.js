// GET    /.netlify/functions/watch  — load current watch
// POST   /.netlify/functions/watch  — save watch
// DELETE /.netlify/functions/watch  — reset watch
// All require Authorization: Bearer <supabase_access_token>

const { getUser, getWatch, upsertWatch, deleteWatch, generateMagicLink } = require('./utils/supabase');
const { sendSms } = require('./utils/twilio');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function unauthorized() {
  return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
}

exports.handler = async function (event) {
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return unauthorized();

  const user = await getUser(token);
  if (!user || !user.id) return unauthorized();

  if (event.httpMethod === 'GET') {
    const watch = await getWatch(user.id);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(watch) };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { film_id, film_name, theatre_ids, theatre_names, format, phone } = body;
    if (!film_id || !film_name || !Array.isArray(theatre_ids) || theatre_ids.length === 0 || !format) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'film_id, film_name, theatre_ids, format are required' }) };
    }

    const existing = await getWatch(user.id);
    const phoneAdded = phone && !existing?.phone;

    await upsertWatch(user.id, {
      film_id,
      film_name,
      theatre_ids:   theatre_ids.slice(0, 5),
      theatre_names: (theatre_names || []).slice(0, 5),
      format,
      phone: phone || null,
      last_seen_ids: [],
    });
    const saved = await getWatch(user.id);

    if (phoneAdded) {
      try {
        const magicLink = await generateMagicLink(user.email);
        await sendSms(phone,
          `Thanks for signing up for Watchr.ca. We will send you one SMS alert when any new screenings appear for your selected film/preferences. Log in to your account anytime at: ${magicLink}`
        );
      } catch (err) {
        console.error('watch: confirmation SMS failed:', err.message);
      }
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(saved) };
  }

  if (event.httpMethod === 'DELETE') {
    await deleteWatch(user.id);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
