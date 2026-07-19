const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;

function supabaseRequest(method, path, { token, useServiceKey = false, body } = {}) {
  const key = useServiceKey ? process.env.SUPABASE_SERVICE_KEY : process.env.SUPABASE_ANON_KEY;
  const url = new URL(path, SUPABASE_URL);
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${token || key}`,
        ...(method === 'POST' || method === 'PATCH' ? { Prefer: 'return=representation' } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let data;
        try { data = JSON.parse(text); } catch (_) { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getUser(accessToken) {
  const { status, data } = await supabaseRequest('GET', '/auth/v1/user', { token: accessToken });
  if (status !== 200) return null;
  return data;
}

async function getWatch(userId) {
  const { status, data } = await supabaseRequest('GET',
    `/rest/v1/watches?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { useServiceKey: true }
  );
  if (status !== 200) throw new Error('DB read failed');
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getAllWatches() {
  const { status, data } = await supabaseRequest('GET', '/rest/v1/watches?select=*', { useServiceKey: true });
  if (status !== 200) throw new Error('DB read failed');
  return Array.isArray(data) ? data : [];
}

async function upsertWatch(userId, fields) {
  const { status, data } = await supabaseRequest('POST', '/rest/v1/watches', {
    useServiceKey: true,
    body: { user_id: userId, ...fields, updated_at: new Date().toISOString() },
  });
  // Supabase upsert: if row exists for user_id, update it
  if (status === 409 || status === 200 || status === 201) {
    if (status === 409) {
      // Row already exists — PATCH instead
      const { status: ps, data: pd } = await supabaseRequest('PATCH',
        `/rest/v1/watches?user_id=eq.${encodeURIComponent(userId)}`,
        { useServiceKey: true, body: { ...fields, updated_at: new Date().toISOString() } }
      );
      return { status: ps, data: pd };
    }
    return { status, data };
  }
  throw new Error(`Upsert failed: ${status}`);
}

async function patchWatch(id, fields) {
  return supabaseRequest('PATCH',
    `/rest/v1/watches?id=eq.${encodeURIComponent(id)}`,
    { useServiceKey: true, body: { ...fields, updated_at: new Date().toISOString() } }
  );
}

async function deleteWatch(userId) {
  return supabaseRequest('DELETE',
    `/rest/v1/watches?user_id=eq.${encodeURIComponent(userId)}`,
    { useServiceKey: true }
  );
}

module.exports = { getUser, getWatch, getAllWatches, upsertWatch, patchWatch, deleteWatch };
