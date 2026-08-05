const express = require('express');
const router = express.Router();

// GET /my → Student: own certificates
router.get('/my', (req, res) => {
  res.json({ success: true, certificates: [] });
});

// POST /generate/:enrollmentId → Admin: generate certificate (→ BullMQ job)
router.post('/generate/:enrollmentId', (req, res) => {
  res.json({ success: true, message: 'Certificate generation job queued (placeholder)' });
});

// GET /verify/:certNo → Public: verify certificate by number
router.get('/verify/:certNo', (req, res) => {
  res.json({ success: true, valid: true, certNo: req.params.certNo });
});

// GET /download/:certNo → Download certificate PDF
router.get('/download/:certNo', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.send('MOCK PDF CERTIFICATE DATA');
});

// GET /admin/all → Admin: all certificates
router.get('/admin/all', (req, res) => {
  res.json({ success: true, certificates: [] });
});

// PUT /admin/:id/revoke → Admin: revoke certificate
router.put('/admin/:id/revoke', (req, res) => {
  res.json({ success: true, message: 'Certificate revoked (placeholder)' });
});

module.exports = router;
