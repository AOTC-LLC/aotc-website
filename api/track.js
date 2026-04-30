export default async function handler(req, res) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const timestamp = new Date().toISOString();
  const ua = req.headers['user-agent'] || '';
  const ref = req.headers['referer'] || '';
  const page = req.query.page || '/';

  let city = '', country = '', region = '';
  try {
    const geo = await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json());
    city = geo.city || '';
    country = geo.country_name || '';
    region = geo.region || '';
  } catch (_) {}

  const log = `VISITOR >>> IP: ${ip} | City: ${city} | Region: ${region} | Country: ${country} | Page: ${page} | Time: ${timestamp}`;
  
  console.log(log);

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ ok: true, ip, city, region, country });
}
