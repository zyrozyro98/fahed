const express = require('express');
const app = express();

// السماح صراحةً بطلبات المتصفح (بما في ذلك OPTIONS Preflight) من أي Origin أثناء الفحص المعتمد
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

// قراءة مختلف أنواع البيانات (JSON, Form URL-Encoded, Plain Text, Raw)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.text({ type: ['text/*', 'application/xml', 'application/*+xml'], limit: '2mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '2mb' }));

// المسارات المستهدفة للفحص (t=0 .. t=6)
const ALLOWED_T_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6']);

function extractTrackInfo(req) {
  const bodyObj = typeof req.body === 'object' && req.body !== null ? req.body : {};
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

  const isTrackedRegisterPage =
    /\/DiplomaReg\/register\.aspx/i.test(rawUrl) &&
    (tParam === null || ALLOWED_T_VALUES.has(String(tParam)));

  return {
    t: tParam !== null ? String(tParam) : 'unknown',
    isAllowedTrack: tParam !== null ? ALLOWED_T_VALUES.has(String(tParam)) : false,
    isTrackedRegisterPage,
    sourceUrl: rawUrl || 'none'
  };
}

// مسار تحقق بسيط لحالة الخدمة
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'xss-poc-collector',
    tracks: Array.from(ALLOWED_T_VALUES)
  });
});

// مسار استقبال وتسجيل الطلبات الواردة من الجميع وعبر جميع المسارات t=0..6
app.all('/collect', (req, res) => {
  const track = extractTrackInfo(req);

  console.log('=== [RECEIVED POC REQUEST] ===');
  console.log('Time:', new Date().toISOString());
  console.log('IP / X-Forwarded-For:', req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'none');
  console.log('Method:', req.method);
  console.log('Origin:', req.headers.origin || 'none');
  console.log('Referer:', req.headers.referer || 'none');
  console.log('Track (t):', track.t, '| Allowed t (0..6):', track.isAllowedTrack, '| Register Page:', track.isTrackedRegisterPage);
  console.log('Source URL:', track.sourceUrl);
  console.log('User-Agent:', req.headers['user-agent'] || 'none');
  console.log('Query:', req.query);
  console.log('Body:', Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body);

  res.status(200).json({
    ok: true,
    track: track.t,
    isAllowedTrack: track.isAllowedTrack,
    receivedAt: new Date().toISOString()
  });
});

// التقاط الأخطاء غير المتوقعة
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
