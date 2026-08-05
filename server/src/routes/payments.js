const express = require('express');
const router = express.Router();

// POST /order → Create Razorpay order
router.post('/order', (req, res) => {
  res.json({ success: true, orderId: 'order_MOCK12345', amount: 500000 });
});

// POST /verify → Verify payment signature + activate enrollment
router.post('/verify', (req, res) => {
  res.json({ success: true, message: 'Payment signature verified successfully (placeholder)' });
});

// GET /my → Student: own payment history
router.get('/my', (req, res) => {
  res.json({ success: true, paymentHistory: [] });
});

// GET /receipt/:id → Download payment receipt PDF
router.get('/receipt/:id', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send('MOCK PDF RECEIPT DATA');
});

// GET /admin/all → Admin: all payments (paginated)
router.get('/admin/all', (req, res) => {
  res.json({ success: true, payments: [] });
});

// GET /admin/stats → Admin: revenue stats
router.get('/admin/stats', (req, res) => {
  res.json({ success: true, totalRevenue: 1500000, currency: 'INR' });
});

// POST /refund/:id → Admin: initiate refund
router.post('/refund/:id', (req, res) => {
  res.json({ success: true, message: 'Refund initiated (placeholder)' });
});

// POST /webhook → Razorpay webhook (no auth, signature verify)
router.post('/webhook', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Webhook event processed (placeholder)' });
});

module.exports = router;
