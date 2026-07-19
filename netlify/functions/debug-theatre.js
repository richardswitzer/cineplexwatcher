const { fetchParsed } = require('./utils/cineplex');

exports.handler = async function () {
  const data = await fetchParsed('37617', '7402');
  const arr = Array.isArray(data) ? data : Object.values(data);
  const first = arr[0] || {};
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      totalTheatres: arr.length,
      firstTheatreKeys: Object.keys(first),
      firstTheatreSample: Object.fromEntries(
        Object.entries(first).filter(([k]) => k !== 'dates').slice(0, 20)
      ),
    }),
  };
};
