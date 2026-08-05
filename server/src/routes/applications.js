const express = require('express');
const router = express.Router();

// POST / → Start new application (creates draft)
router.post('/', (req, res) => {
  res.json({ success: true, message: 'Draft application created (placeholder)' });
});

// GET /my → Student: get own application status
router.get('/my', (req, res) => {
  res.json({ success: true, applications: [] });
});

// PUT /:id/step/:step → Save application step data (1–4)
router.put('/:id/step/:step', (req, res) => {
  res.json({ success: true, message: `Step ${req.params.step} saved (placeholder)` });
});

// POST /:id/submit → Submit completed application
router.post('/:id/submit', (req, res) => {
  res.json({ success: true, message: 'Application submitted (placeholder)' });
});

// POST /:id/payment → Initiate application fee payment
router.post('/:id/payment', (req, res) => {
  res.json({ success: true, message: 'Payment initiated (placeholder)' });
});

// GET / → Admin: list all applications (paginated)
router.get('/', (req, res) => {
  res.json({ success: true, applications: [] });
});

// GET /:id → Admin: get application details
router.get('/:id', (req, res) => {
  res.json({ success: true, application: {} });
});

// PUT /:id/status → Admin: accept / reject / waitlist
router.put('/:id/status', (req, res) => {
  res.json({ success: true, message: 'Application status changed (placeholder)' });
});

// DELETE /:id → Admin: delete draft application
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Draft deleted (placeholder)' });
});

module.exports = router;
