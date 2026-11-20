const express = require('express');
const app = express();

// السماح بطلبات المتصفح ومعالجة طلبات OPTIONS (Preflight)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// قراءة البيانات المرسلة بأي صيغة (JSON, Form, Text)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.text({ type: '*/*', limit: '5mb' }));

const TARGET_TRACKS = new Set(['0', '1', '2', '3', '4', '5', '6']);

function decodePayload(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return { raw: req.body };
    }
  }
  return req.body || {};
}

function getTrackCode(req, payload) {
  const href = payload.href || payload.url || req.headers.referer || '';
  const rawT = req.query.t || payload.t || null;

  if (rawT !== null && TARGET_TRACKS.has(String(rawT))) {
    return String(rawT);
  }

  const match = String(href).match(/[?&]t=([0-6])\b/);
  return match ? match[1] : 'unknown';
}

app.get('/', (req, res) => {
  res.status(200).json({ ok: true, service: 'collector-v2' });
});

app.all('/collect', (req, res) => {
  const payload = decodePayload(req);
  const track = getTrackCode(req, payload);
  const fields = payload.fields && typeof payload.fields === 'object' ? payload.fields : payload;

  console.log('----------------------------------------');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Track (t):', track);
  console.log('Origin:', req.headers.origin || 'none');
  console.log('Referer:', req.headers.referer || 'none');
  console.log('URL:', payload.href || payload.url || req.headers.referer || 'none');
  console.log('Data:', JSON.stringify(fields, null, 2));
  console.log('----------------------------------------');

  res.status(200).json({ ok: true, track });
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]:', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Collector v2 listening on port ${PORT}`);
});
