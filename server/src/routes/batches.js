const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const { protect, restrictTo } = require('../middleware/auth');

// GET / → Admin/Public: list all batches (filter by program/status)
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.program) filter.program = req.query.program;
    if (req.query.status) filter.status = req.query.status;

    const batches = await Batch.find(filter).populate('program').sort({ startDate: 1 });
    res.json({ success: true, batches });
  } catch (error) {
    next(error);
  }
});

// GET /program/:programId → Public: get available batches for a program
router.get('/program/:programId', async (req, res, next) => {
  try {
    const batches = await Batch.find({ program: req.params.programId, status: { $in: ['upcoming', 'active'] } }).populate('program');
    res.json({ success: true, batches });
  } catch (error) {
    next(error);
  }
});

// POST / → Admin: create batch
router.post('/', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { program, batchCode, startDate, endDate, schedule, maxSeats, isOnline } = req.body;
    
    if (!program || !batchCode || !startDate) {
      return res.status(400).json({ success: false, message: 'Program, batchCode, and startDate are required' });
    }

    const batch = await Batch.create({
      program,
      batchCode,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      schedule: schedule || { days: ['Mon', 'Wed', 'Fri'], startTime: '09:00', endTime: '11:00' },
      maxSeats: maxSeats || 60,
      isOnline: isOnline !== undefined ? isOnline : true
    });

    res.status(201).json({ success: true, message: 'Batch created successfully', batch });
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin: update batch
router.put('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    res.json({ success: true, message: 'Batch updated successfully', batch });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin: delete batch
router.delete('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
