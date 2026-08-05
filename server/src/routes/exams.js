const express = require('express');
const router = express.Router();

// GET /my → Student: upcoming + past exams
router.get('/my', (req, res) => {
  res.json({ success: true, exams: [] });
});

// GET /:id → Get exam details (no questions exposed until start)
router.get('/:id', (req, res) => {
  res.json({ success: true, exam: { id: req.params.id } });
});

// POST / → Admin: create exam
router.post('/', (req, res) => {
  res.json({ success: true, message: 'Exam created (placeholder)' });
});

// PUT /:id → Admin: update exam config
router.put('/:id', (req, res) => {
  res.json({ success: true, message: 'Exam updated (placeholder)' });
});

// DELETE /:id → Admin: delete exam
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Exam deleted (placeholder)' });
});

// POST /:id/publish → Admin: publish exam to batch
router.post('/:id/publish', (req, res) => {
  res.json({ success: true, message: 'Exam published (placeholder)' });
});

// POST /:id/results/release → Admin: release results
router.post('/:id/results/release', (req, res) => {
  res.json({ success: true, message: 'Exam results released (placeholder)' });
});

// GET /:id/results → Admin: all results for this exam
router.get('/:id/results', (req, res) => {
  res.json({ success: true, results: [] });
});

// GET /:id/results/export → Admin: export results CSV
router.get('/:id/results/export', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.send('studentId,score,passed\n1,85,true');
});

// ==========================================
// EXAM SESSION ATTEMPTS
// ==========================================

// POST /sessions/start/:examId → Student: enter lobby, verify identity
router.post('/sessions/start/:examId', (req, res) => {
  res.json({ success: true, sessionId: 'EXAM-SESSION-1234', message: 'Exam started' });
});

// POST /sessions/:sessionId/submit → Student: submit exam
router.post('/sessions/:sessionId/submit', (req, res) => {
  res.json({ success: true, message: 'Exam submitted successfully' });
});

// PUT /sessions/:sessionId/answer → Student: save answer (auto-save)
router.put('/sessions/:sessionId/answer', (req, res) => {
  res.json({ success: true, message: 'Answer saved' });
});

// GET /sessions/:sessionId/result → Get own result + incident timeline
router.get('/sessions/:sessionId/result', (req, res) => {
  res.json({ success: true, score: {}, incidents: [] });
});

// GET /sessions/admin/all → Admin: all exam sessions
router.get('/sessions/admin/all', (req, res) => {
  res.json({ success: true, sessions: [] });
});

// GET /sessions/admin/:sessionId → Admin: detailed session review
router.get('/sessions/admin/:sessionId', (req, res) => {
  res.json({ success: true, session: {} });
});

// PUT /sessions/admin/:sessionId/resolve → Admin: approve/invalidate/warn
router.put('/sessions/admin/:sessionId/resolve', (req, res) => {
  res.json({ success: true, message: 'Incident resolved' });
});

// ==========================================
// QUESTIONS BANK
// ==========================================

// GET /questions → Admin: question bank (search/filter)
router.get('/questions', (req, res) => {
  res.json({ success: true, questions: [] });
});

// POST /questions → Admin: create question
router.post('/questions', (req, res) => {
  res.json({ success: true, message: 'Question created' });
});

// POST /questions/bulk → Admin: bulk import (JSON/CSV)
router.post('/questions/bulk', (req, res) => {
  res.json({ success: true, message: 'Questions imported' });
});

// PUT /questions/:id → Admin: update question
router.put('/questions/:id', (req, res) => {
  res.json({ success: true, message: 'Question updated' });
});

// DELETE /questions/:id → Admin: delete question
router.delete('/questions/:id', (req, res) => {
  res.json({ success: true, message: 'Question deleted' });
});

module.exports = router;
