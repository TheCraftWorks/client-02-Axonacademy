const express = require('express');
const router = express.Router();
const LibraryFolder = require('../models/LibraryFolder');
const LibraryRecording = require('../models/LibraryRecording');
const { protect, restrictTo } = require('../middleware/auth');

// GET / -> Get all folders (and root recordings)
router.get('/', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const folders = await LibraryFolder.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, folders });
  } catch (error) {
    next(error);
  }
});

// POST / -> Create new folder
router.post('/', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Folder name is required' });

    const folder = await LibraryFolder.create({
      name,
      description,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, folder });
  } catch (error) {
    next(error);
  }
});

// PUT /:id -> Update folder
router.put('/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const folder = await LibraryFolder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
    res.json({ success: true, folder });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id -> Delete folder and cascade delete all its recordings
router.delete('/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const folder = await LibraryFolder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    // Find all recordings in this folder
    const recordings = await LibraryRecording.find({ folder: folder._id });
    
    // Import R2 delete helper
    const { deleteFileFromCloudflareR2 } = require('../config/cloudflare');
    
    // Delete files from R2
    for (const recording of recordings) {
      if (recording.cloudflareKey) {
        await deleteFileFromCloudflareR2(recording.cloudflareKey).catch(err => {
          console.error(`[R2 Delete Error] Failed to delete key ${recording.cloudflareKey} during folder delete:`, err);
        });
      }
    }

    // Delete recording documents from DB
    await LibraryRecording.deleteMany({ folder: folder._id });
    
    await folder.deleteOne();
    res.json({ success: true, message: 'Folder and all videos inside it deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
