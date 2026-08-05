const express = require('express');
const router = express.Router();

// GET /program/:programId → Get all lessons for a program (auth required if enrolled)
router.get('/program/:programId', (req, res) => {
  res.json({ success: true, lessons: [] });
});

// GET /:id → Get single lesson detail
router.get('/:id', (req, res) => {
  res.json({ success: true, lesson: {} });
});

// POST / → Admin/Faculty: create lesson
router.post('/', (req, res) => {
  res.json({ success: true, message: 'Lesson created (placeholder)' });
});

// PUT /:id → Admin/Faculty: update lesson
router.put('/:id', (req, res) => {
  res.json({ success: true, message: 'Lesson updated (placeholder)' });
});

// DELETE /:id → Admin: delete lesson
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Lesson deleted (placeholder)' });
});

// POST /:id/progress → Student: mark lesson watched/complete
router.post('/:id/progress', (req, res) => {
  res.json({ success: true, message: 'Lesson progress registered (placeholder)' });
});

// GET /:id/transcript → Get lesson transcript
router.get('/:id/transcript', (req, res) => {
  res.json({ success: true, transcript: [] });
});

// POST /:id/video/upload → Instructor: get Mux upload URL
router.post('/:id/video/upload', (req, res) => {
  res.json({ success: true, uploadUrl: 'http://mux.com/upload-target' });
});

module.exports = router;
