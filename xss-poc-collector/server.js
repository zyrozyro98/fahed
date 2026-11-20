const express = require('express');
const cors = require('cors');

const app = express();

// السماح بطلبات المتصفح من نطاقات الفحص أثناء الاختبار المعتمد
app.use(cors({ origin: true, credentials: false }));

// قراءة أنواع البيانات الشائعة في الطلبات الواردة
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ type: '*/*', limit: '1mb' }));

// مسار تحقق بسيط للتأكد من أن الخدمة تعمل
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'xss-poc-collector' });
});

// مسار استقبال وتسجيل إشارات إثبات المفهوم (PoC)
app.all('/collect', (req, res) => {
  console.log('=== [RECEIVED POC REQUEST] ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Origin:', req.headers.origin || 'none');
  console.log('Referer:', req.headers.referer || 'none');
  console.log('User-Agent:', req.headers['user-agent'] || 'none');
  console.log('Query:', req.query);
  console.log('Body:', req.body);

  res.status(200).json({ ok: true });
});

// التقاط الأخطاء غير المتوقعة لعدم خروج العملية بصمت
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
