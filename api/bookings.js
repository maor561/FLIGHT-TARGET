// Vercel Serverless Function — proxies VATSIM ATC Bookings API
// Bypasses browser CORS restrictions by fetching server-side

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    try {
        const response = await fetch('https://api.vatsim.net/v2/atc/bookings?airports=LLBG,LLLL', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FlightTarget/1.0'
            }
        });

        if (!response.ok) {
            // Try without filter — get all and filter client-side
            const fallback = await fetch('https://api.vatsim.net/v2/atc/bookings', {
                headers: { 'Accept': 'application/json', 'User-Agent': 'FlightTarget/1.0' }
            });
            if (!fallback.ok) {
                return res.status(fallback.status).json({ error: 'VATSIM bookings unavailable', status: fallback.status });
            }
            const data = await fallback.json();
            // Filter for LLBG/LLLL
            const filtered = Array.isArray(data)
                ? data.filter(b => b.callsign?.startsWith('LLBG') || b.callsign?.startsWith('LLLL'))
                : data;
            return res.status(200).json(filtered);
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
