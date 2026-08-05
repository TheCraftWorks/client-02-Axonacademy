const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage, cloudinary } = require('../config/cloudinary');
const Program = require('../models/Program');
const { protect, restrictTo } = require('../middleware/auth');

const upload = multer({ storage });

// GET / → Public: list published programs
router.get('/', async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    // If user is admin, allow viewing all programs (draft and published)
    // We can check if a token exists, but let's default to published for registration choice
    const programs = await Program.find(filter).sort({ title: 1 });
    res.json({ success: true, programs });
  } catch (error) {
    next(error);
  }
});

// GET /admin-list → Admin: list all programs
router.get('/admin-all', async (req, res, next) => {
  try {
    const programs = await Program.find().sort({ title: 1 });
    res.json({ success: true, programs });
  } catch (error) {
    next(error);
  }
});

// GET /featured → Public: get featured programs (homepage)
router.get('/featured', async (req, res, next) => {
  try {
    const featuredPrograms = await Program.find({ isFeatured: true, isPublished: true });
    res.json({ success: true, featuredPrograms });
  } catch (error) {
    next(error);
  }
});

// GET /:slug → Public: get program detail by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const program = await Program.findOne({ slug: req.params.slug });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, program });
  } catch (error) {
    next(error);
  }
});

// POST / → Admin: create program
router.post('/', protect, restrictTo('admin', 'superadmin'), upload.single('image'), async (req, res, next) => {
  try {
    const { title, slug, subtitle, description, shortDesc, category, specialty, duration, rating, fee, status, isPublished } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const image = req.file ? req.file.path : undefined;
    const imagePublicId = req.file ? req.file.filename : undefined;

    // Auto-generate slug from title if not provided
    const baseSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now()}`;

    // Derive isPublished from status, fallback to explicit isPublished field
    const resolvedStatus = status || (isPublished ? 'published' : 'draft');

    let parsedFee;
    try {
      parsedFee = fee ? JSON.parse(fee) : undefined;
    } catch {
      parsedFee = { baseAmount: Number(fee) || 10000, gstPercent: 18, emiAvailable: true, scholarshipAvailable: false };
    }

    const program = await Program.create({
      title,
      slug: uniqueSlug,
      subtitle,
      description,
      shortDesc,
      category,
      specialty,
      duration,
      rating: rating ? Number(rating) : 4.5,
      image,
      imagePublicId,
      fee: parsedFee || { baseAmount: 10000, gstPercent: 18, emiAvailable: true, scholarshipAvailable: false },
      status: resolvedStatus,
      isPublished: resolvedStatus === 'published',
    });

    res.status(201).json({ success: true, message: 'Program created successfully', program });
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin: update program
router.put('/:id', protect, restrictTo('admin', 'superadmin'), upload.single('image'), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    // Keep isPublished in sync if status is being updated
    if (updates.status !== undefined) {
      updates.isPublished = updates.status === 'published';
    }

    if (updates.fee && typeof updates.fee === 'string') {
      try {
        updates.fee = JSON.parse(updates.fee);
      } catch {
        updates.fee = { baseAmount: Number(updates.fee) || 0, gstPercent: 18 };
      }
    }

    if (req.file) {
      const existingProgram = await Program.findById(req.params.id);
      if (existingProgram && existingProgram.imagePublicId) {
        cloudinary.uploader.destroy(existingProgram.imagePublicId).catch(err => console.error('Cloudinary delete error:', err));
      }
      updates.image = req.file.path;
      updates.imagePublicId = req.file.filename;
    } else if (updates.removeImage === 'true' || updates.removeImage === true) {
      const existingProgram = await Program.findById(req.params.id);
      if (existingProgram && existingProgram.imagePublicId) {
        cloudinary.uploader.destroy(existingProgram.imagePublicId).catch(err => console.error('Cloudinary delete error:', err));
      }
      updates.image = null;
      updates.imagePublicId = null;
    }

    const program = await Program.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: false }
    );
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, message: 'Program updated successfully', program });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin: soft-delete program
router.delete('/:id', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    if (program.imagePublicId) {
      cloudinary.uploader.destroy(program.imagePublicId).catch(err => console.error('Cloudinary delete error:', err));
    }
    await program.deleteOne();
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
