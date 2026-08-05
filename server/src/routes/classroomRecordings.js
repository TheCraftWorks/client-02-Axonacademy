const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');

const ClassroomRecording = require('../models/ClassroomRecording');
const ClassroomFolder = require('../models/ClassroomFolder');
const Classroom = require('../models/Classroom');
const VideoPlaybackError = require('../models/VideoPlaybackError');
const { protect, restrictTo, verifyClassroomAccess } = require('../middleware/auth');
const {
  uploadFileToCloudflareR2,
  deleteFileFromCloudflareR2,
  generatePresignedUploadUrl,
  createMultipartUpload,
  generatePresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} = require('../config/cloudflare');

// ✅ Memory storage — file never touches disk
const upload = multer({ storage: multer.memoryStorage() });

// ─── ObjectId validation helper ───────────────────────────────────────────────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const verifyClassroomAccessById = async (classroomId, user, writeRequired = false) => {
  if (!classroomId) return false;
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) return false;
  return verifyClassroomAccess(classroom, user, writeRequired);
};

// =============================================================================
// STATIC NAMED ROUTES — must be defined BEFORE any /:id dynamic routes
// =============================================================================

// POST /log-error → Log video playback errors from students
router.post('/log-error', protect, async (req, res, next) => {
  try {
    const { recordingId, classroomId, errorCode, errorMessage, userAgent, videoUrl } = req.body;

    if (!recordingId) {
      return res.status(400).json({ success: false, message: 'recordingId is required' });
    }

    // Clean/sanitize URL to mask sensitive Cloudflare signatures/keys (e.g. AWS access keys / signature parameters)
    let cleanVideoUrl = videoUrl || '';
    if (cleanVideoUrl) {
      try {
        const urlObj = new URL(cleanVideoUrl);
        const paramsToRemove = ['X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Security-Token', 'token', 'sig', 'expires'];
        paramsToRemove.forEach(p => urlObj.searchParams.delete(p));
        cleanVideoUrl = urlObj.toString();
      } catch {
        cleanVideoUrl = cleanVideoUrl.split('?')[0];
      }
    }

    const errorLog = await VideoPlaybackError.create({
      recording: recordingId,
      recordingModel: req.body.recordingModel || 'ClassroomRecording',
      student: req.user._id,
      classroom: isValidId(classroomId) ? classroomId : null,
      errorCode: errorCode ? parseInt(errorCode, 10) : null,
      errorMessage: errorMessage || 'Unknown playback error',
      userAgent: userAgent || req.headers['user-agent'],
      videoUrl: cleanVideoUrl
    });

    res.status(201).json({ success: true, message: 'Error logged successfully', errorLog });
  } catch (error) {
    next(error);
  }
});

// GET /classroom/:classroomId → Get all recordings for a classroom
router.get('/classroom/:classroomId', protect, async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const isAdmin = ['admin', 'superadmin', 'faculty'].includes(req.user.role);

    const folders = await ClassroomFolder.find({ classroom: req.params.classroomId }).sort({ order: 1, createdAt: -1 }).lean();

    const filter = { classroom: req.params.classroomId };
    if (!isAdmin) filter.isPublished = true;

    const recordings = await ClassroomRecording.find(filter)
      .populate('uploadedBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    const { generatePresignedGetUrl } = require('../config/cloudflare');
    for (let rec of recordings) {
      if (rec.storageProvider === 'cloudflare' && rec.cloudflareKey) {
        rec.cloudflareUrl = await generatePresignedGetUrl(rec.cloudflareKey, 604800); // 7 days expiration
      }
    }

    res.json({ success: true, folders, recordings });
  } catch (error) {
    next(error);
  }
});

// GET /classroom/:classroomId/analytics → Admin: all recordings' stats for classroom
router.get('/classroom/:classroomId/analytics', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const recordings = await ClassroomRecording.find({ classroom: req.params.classroomId })
      .populate('viewStats.student', 'fullName email');
    res.json({ success: true, recordings });
  } catch (error) {
    next(error);
  }
});

// POST /upload-url → Admin: Get Mux direct upload URL or mock
router.post('/upload-url', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    res.json({
      success: true,
      isMock: true,
      uploadUrl: `${process.env.API_BASE_URL || ''}/api/v1/recordings/classroom/mock-upload`,
      playbackId: `mock_playback_id_${Date.now()}`,
      assetId: `mock_asset_id_${Date.now()}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /presigned-url → Admin: Generate a presigned R2 PUT URL for direct browser upload
// The video is uploaded directly from the browser to Cloudflare R2 — Railway is NOT involved
// in transferring the bytes, so there are no timeouts even for 3 GB files.
router.post('/presigned-url', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { classroom, filename, contentType } = req.body;

    if (!classroom || !filename) {
      return res.status(400).json({ success: false, message: 'classroom and filename are required' });
    }
    if (!isValidId(classroom)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    // Sanitise filename — strip path separators that could break R2 keys
    const safeName = filename.replace(/[/\\]/g, '_');
    const objectKey = `classroom-recordings/${classroom}/${Date.now()}-${safeName}`;

    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(
      objectKey,
      contentType || 'video/mp4',
      3600 // 1-hour window — enough for very large uploads
    );

    res.json({ success: true, uploadUrl, objectKey, publicUrl });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// MULTIPART UPLOAD ROUTES (100 MB chunks — supports 1 GB–3 GB+ videos)
// Browser uploads each chunk directly to R2 via a per-part presigned URL.
// Railway only orchestrates (tiny JSON) — never touches the video bytes.
// =============================================================================

// POST /multipart/initiate → Admin: start a multipart upload, get uploadId + objectKey
router.post('/multipart/initiate', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { classroom, filename, contentType } = req.body;

    if (!classroom || !filename) {
      return res.status(400).json({ success: false, message: 'classroom and filename are required' });
    }
    if (!isValidId(classroom)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    const safeName = filename.replace(/[/\\]/g, '_');
    const objectKey = `classroom-recordings/${classroom}/${Date.now()}-${safeName}`;

    const uploadId = await createMultipartUpload(objectKey, contentType || 'video/mp4');

    const { getR2ObjectUrl } = require('../config/cloudflare');
    const publicUrl = getR2ObjectUrl(objectKey);

    res.json({ success: true, uploadId, objectKey, publicUrl });
  } catch (error) {
    next(error);
  }
});

// POST /multipart/presign-part → Admin: get a presigned URL for one chunk (partNumber)
router.post('/multipart/presign-part', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { objectKey, uploadId, partNumber } = req.body;

    if (!objectKey || !uploadId || partNumber == null) {
      return res.status(400).json({ success: false, message: 'objectKey, uploadId and partNumber are required' });
    }

    const num = parseInt(partNumber, 10);
    if (isNaN(num) || num < 1 || num > 10000) {
      return res.status(400).json({ success: false, message: 'partNumber must be 1–10 000' });
    }

    // 2-hour window per part (100 MB on a slow connection can take >1 h)
    const presignedUrl = await generatePresignedPartUrl(objectKey, uploadId, num, 7200);

    res.json({ success: true, presignedUrl });
  } catch (error) {
    next(error);
  }
});

// POST /multipart/complete → Admin: tell R2 to assemble all uploaded parts
router.post('/multipart/complete', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { objectKey, uploadId, parts } = req.body;

    if (!objectKey || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ success: false, message: 'objectKey, uploadId, and parts[] are required' });
    }

    // Ensure parts are sorted by PartNumber (R2 requirement)
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

    const publicUrl = await completeMultipartUpload(objectKey, uploadId, sortedParts);

    res.json({ success: true, publicUrl });
  } catch (error) {
    next(error);
  }
});

// POST /multipart/abort → Admin: cancel upload and free partial storage on R2
router.post('/multipart/abort', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { objectKey, uploadId } = req.body;

    if (!objectKey || !uploadId) {
      return res.status(400).json({ success: false, message: 'objectKey and uploadId are required' });
    }

    await abortMultipartUpload(objectKey, uploadId);

    res.json({ success: true, message: 'Multipart upload aborted and storage freed' });
  } catch (error) {
    next(error);
  }
});

// POST /save-recording → Admin/Faculty: Save metadata AFTER the browser PUT to R2 completes
router.post('/save-recording', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { classroom, title, description, duration, isPublished, objectKey, publicUrl, chapters, folderId } = req.body;

    if (!classroom || !title || !objectKey) {
      return res.status(400).json({ success: false, message: 'classroom, title, and objectKey are required' });
    }
    if (!isValidId(classroom)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    if (!(await verifyClassroomAccessById(classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    let parsedChapters = [];
    if (chapters) {
      try {
        parsedChapters = typeof chapters === 'string' ? JSON.parse(chapters) : chapters;
      } catch {
        parsedChapters = [];
      }
    }

    const { getR2ObjectUrl } = require('../config/cloudflare');
    const resolvedUrl = publicUrl || getR2ObjectUrl(objectKey);

    const recording = await ClassroomRecording.create({
      classroom,
      folder: isValidId(folderId) ? folderId : null,
      title,
      description,
      uploadedBy: req.user._id,
      storageProvider: 'cloudflare',
      cloudflareKey: objectKey,
      cloudflareUrl: resolvedUrl,
      isPublished: isPublished === true || isPublished === 'true',
      chapters: parsedChapters,
      muxStatus: 'ready',
      duration: duration ? parseInt(duration, 10) : 0,
      thumbnail: '/default-video-thumb.jpg',
      security: {
        signedUrlRequired: false,
        urlExpiryHours: 0,
        watermark: true,
        downloadBlocked: true,
        screenRecordDetect: false,
        devToolsBlocked: false,
      },
    });

    await Classroom.findByIdAndUpdate(classroom, {
      $inc: { 'stats.totalRecordings': 1 },
    });

    res.status(201).json({
      success: true,
      message: 'Recording saved successfully',
      recording,
    });
  } catch (error) {
    next(error);
  }
});

// POST /mock-upload → Admin/Faculty: Local mock upload (memory-based, no disk write)
router.post('/mock-upload', protect, restrictTo('admin', 'superadmin', 'faculty'), upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }
    res.json({
      success: true,
      playbackId: `mock_playback_${Date.now()}`,
      assetId: `mock_asset_${Date.now()}`,
      duration: 120
    });
  } catch (error) {
    next(error);
  }
});

// POST /upload-cloudflare → Admin/Faculty: upload recording DIRECTLY to Cloudflare R2
router.post('/upload-cloudflare', protect, restrictTo('admin', 'superadmin', 'faculty'), upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    const { classroom, title, description, duration, isPublished, folderId } = req.body;

    if (!classroom || !title) {
      return res.status(400).json({ success: false, message: 'Classroom and title are required' });
    }

    // Validate classroom is a real ObjectId
    if (!isValidId(classroom)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    if (!(await verifyClassroomAccessById(classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    let chapters = [];
    if (req.body.chapters) {
      try {
        chapters = typeof req.body.chapters === 'string' ? JSON.parse(req.body.chapters) : req.body.chapters;
      } catch {
        chapters = [];
      }
    }
    const published = isPublished === 'true' || isPublished === true;

    // Upload buffer directly to R2 — no temp file
    const objectKey = `classroom-recordings/${classroom}/${Date.now()}-${req.file.originalname}`;
    const uploadResult = await uploadFileToCloudflareR2(
      req.file.buffer,
      objectKey,
      req.file.mimetype
    );

    const recording = await ClassroomRecording.create({
      classroom,
      folder: isValidId(folderId) ? folderId : null,
      title,
      description,
      uploadedBy: req.user._id,
      storageProvider: 'cloudflare',
      cloudflareKey: objectKey,
      cloudflareUrl: uploadResult.url,
      isPublished: published,
      chapters,
      muxStatus: 'ready',
      duration: duration ? parseInt(duration, 10) : 0,
      thumbnail: '/default-video-thumb.jpg',
      security: {
        signedUrlRequired: false,
        urlExpiryHours: 0,
        watermark: true,
        downloadBlocked: true,
        screenRecordDetect: false,
        devToolsBlocked: false
      }
    });

    await Classroom.findByIdAndUpdate(classroom, {
      $inc: { 'stats.totalRecordings': 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Recording uploaded to Cloudflare R2 successfully',
      recording
    });
  } catch (error) {
    next(error);
  }
});

// POST / → Admin/Faculty: save recording metadata after Mux upload
router.post('/', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { classroom, title, description, muxAssetId, muxPlaybackId, duration, security } = req.body;

    if (!classroom || !title || !muxPlaybackId) {
      return res.status(400).json({ success: false, message: 'Classroom, title, and playbackId are required' });
    }

    if (!isValidId(classroom)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    if (!(await verifyClassroomAccessById(classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const recording = await ClassroomRecording.create({
      classroom,
      title,
      description,
      uploadedBy: req.user._id,
      muxAssetId: muxAssetId || 'mock_asset_id',
      muxPlaybackId,
      muxStatus: 'ready',
      duration: duration || 0,
      thumbnail: muxPlaybackId.startsWith('/uploads/')
        ? '/default-video-thumb.jpg'
        : `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`,
      security: security || {
        signedUrlRequired: true,
        urlExpiryHours: 6,
        watermark: true,
        downloadBlocked: true,
        screenRecordDetect: true,
        devToolsBlocked: true
      }
    });

    await Classroom.findByIdAndUpdate(classroom, {
      $inc: { 'stats.totalRecordings': 1 }
    });

    res.status(201).json({ success: true, message: 'Recording saved successfully', recording });
  } catch (error) {
    next(error);
  }
});

// POST /reuse → Admin/Faculty: reuse/duplicate recording from another classroom (tracking is unique per class)
router.post('/reuse', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { sourceRecordingId, targetClassroomId, title, description, folderId } = req.body;

    if (!sourceRecordingId || !targetClassroomId) {
      return res.status(400).json({ success: false, message: 'sourceRecordingId and targetClassroomId are required' });
    }

    if (!isValidId(sourceRecordingId) || !isValidId(targetClassroomId)) {
      return res.status(400).json({ success: false, message: 'Invalid sourceRecordingId or targetClassroomId' });
    }

    const sourceRec = await ClassroomRecording.findById(sourceRecordingId);
    if (!sourceRec) {
      return res.status(404).json({ success: false, message: 'Source recording not found' });
    }

    const targetClassroom = await Classroom.findById(targetClassroomId);
    if (!targetClassroom) {
      return res.status(404).json({ success: false, message: 'Target classroom not found' });
    }

    if (!verifyClassroomAccess(targetClassroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const newRec = await ClassroomRecording.create({
      classroom: targetClassroomId,
      folder: isValidId(folderId) ? folderId : null,
      title: title || sourceRec.title,
      description: description || sourceRec.description,
      uploadedBy: req.user._id,
      storageProvider: sourceRec.storageProvider,
      muxAssetId: sourceRec.muxAssetId,
      muxPlaybackId: sourceRec.muxPlaybackId,
      muxStatus: sourceRec.muxStatus,
      cloudflareKey: sourceRec.cloudflareKey,
      cloudflareUrl: sourceRec.cloudflareUrl,
      duration: sourceRec.duration,
      thumbnail: sourceRec.thumbnail,
      chapters: sourceRec.chapters ? sourceRec.chapters.map(c => ({
        title: c.title,
        startTimeSec: c.startTimeSec,
        order: c.order
      })) : [],
      security: { ...sourceRec.security },
      viewStats: [],
      isPublished: false,
      version: 1
    });

    await Classroom.findByIdAndUpdate(targetClassroomId, {
      $inc: { 'stats.totalRecordings': 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Recording reused successfully in target classroom',
      recording: newRec
    });
  } catch (error) {
    next(error);
  }
});

// POST /assign-from-library → Admin/Faculty: assign a recording from global library to a classroom
router.post('/assign-from-library', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { libraryRecordingId, targetClassroomId } = req.body;
    if (!libraryRecordingId || !targetClassroomId) {
      return res.status(400).json({ success: false, message: 'libraryRecordingId and targetClassroomId are required' });
    }
    
    const LibraryRecording = require('../models/LibraryRecording');
    const sourceRec = await LibraryRecording.findById(libraryRecordingId);
    if (!sourceRec) {
      return res.status(404).json({ success: false, message: 'Library recording not found' });
    }
    
    const targetClassroom = await Classroom.findById(targetClassroomId);
    if (!targetClassroom) {
      return res.status(404).json({ success: false, message: 'Target classroom not found' });
    }

    if (!verifyClassroomAccess(targetClassroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }
    
    // Create new ClassroomRecording to track analytics properly for this classroom
    const newRec = await ClassroomRecording.create({
      classroom: targetClassroomId,
      title: sourceRec.title,
      description: sourceRec.description,
      uploadedBy: req.user._id,
      storageProvider: sourceRec.storageProvider,
      muxAssetId: sourceRec.muxAssetId,
      muxPlaybackId: sourceRec.muxPlaybackId,
      muxStatus: sourceRec.muxStatus,
      cloudflareKey: sourceRec.cloudflareKey,
      cloudflareUrl: sourceRec.cloudflareUrl,
      duration: sourceRec.duration,
      thumbnail: sourceRec.thumbnail,
      chapters: [],
      security: { ...sourceRec.security },
      viewStats: [],
      isPublished: true, // Auto publish upon assignment
      version: 1
    });
    
    await Classroom.findByIdAndUpdate(targetClassroomId, {
      $inc: { 'stats.totalRecordings': 1 }
    });
    
    res.status(201).json({ success: true, message: 'Assigned successfully', recording: newRec });
  } catch (error) {
    next(error);
  }
});

// POST /folders → Admin/Faculty: Create a new classroom folder
router.post('/folders', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { classroomId, name, description } = req.body;
    if (!classroomId || !name) {
      return res.status(400).json({ success: false, message: 'classroomId and name are required' });
    }
    if (!isValidId(classroomId)) {
      return res.status(400).json({ success: false, message: 'Invalid classroom ID' });
    }

    const folder = await ClassroomFolder.create({
      name,
      description,
      classroom: classroomId,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, folder });
  } catch (error) {
    next(error);
  }
});

// PUT /folders/:id → Admin/Faculty: Update a folder's name/description
router.put('/folders/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid folder ID' });
    }
    const folder = await ClassroomFolder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
    res.json({ success: true, folder });
  } catch (error) {
    next(error);
  }
});

// DELETE /folders/:id → Admin/Faculty: Delete folder and cascadingly delete all recordings inside it
router.delete('/folders/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid folder ID' });
    }
    const folder = await ClassroomFolder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    // Find all recordings in this folder
    const recordings = await ClassroomRecording.find({ folder: folder._id });
    
    // Delete files from R2 safely (only if not shared/reused elsewhere)
    const { deleteFileFromCloudflareR2 } = require('../config/cloudflare');
    const LibraryRecording = require('../models/LibraryRecording');
    for (const recording of recordings) {
      if (recording.cloudflareKey) {
        const libraryCount = await LibraryRecording.countDocuments({ cloudflareKey: recording.cloudflareKey });
        const classroomCount = await ClassroomRecording.countDocuments({ cloudflareKey: recording.cloudflareKey });

        // If no library recording references this key, and it's only in this classroom (count <= 1), delete from R2
        if (libraryCount === 0 && classroomCount <= 1) {
          await deleteFileFromCloudflareR2(recording.cloudflareKey).catch(err => {
            console.error(`[R2 Delete Error] Failed to delete key ${recording.cloudflareKey} during folder delete:`, err);
          });
        }
      }
    }

    // Decrement stats
    await Classroom.findByIdAndUpdate(folder.classroom, {
      $inc: { 'stats.totalRecordings': -recordings.length }
    });

    // Delete recording documents from DB
    await ClassroomRecording.deleteMany({ folder: folder._id });
    
    await folder.deleteOne();
    res.json({ success: true, message: 'Folder and all videos inside it deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /reuse-list → Admin/Faculty: Get list of other classrooms, their folders, and recordings for reuse
router.get('/reuse-list', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    let classroomFilter = { status: 'active' };
    if (req.user.role === 'faculty') {
      classroomFilter.instructors = req.user._id;
    }
    
    const classrooms = await Classroom.find(classroomFilter).select('name code program').lean();
    const classroomIds = classrooms.map(c => c._id);

    const folders = await ClassroomFolder.find({ classroom: { $in: classroomIds } }).lean();
    const recordings = await ClassroomRecording.find({ classroom: { $in: classroomIds } }).lean();

    res.json({
      success: true,
      classrooms: classrooms.map(c => ({ ...c, id: c._id.toString() })),
      folders: folders.map(f => ({ ...f, id: f._id.toString() })),
      recordings: recordings.map(r => ({ ...r, id: r._id.toString() }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /reuse-folder → Admin/Faculty: reuse/duplicate a folder and all (or selected) videos inside it to target classroom
router.post('/reuse-folder', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { sourceFolderId, targetClassroomId, selectedRecordingIds } = req.body;
    if (!sourceFolderId || !targetClassroomId) {
      return res.status(400).json({ success: false, message: 'sourceFolderId and targetClassroomId are required' });
    }

    if (!isValidId(sourceFolderId) || !isValidId(targetClassroomId)) {
      return res.status(400).json({ success: false, message: 'Invalid sourceFolderId or targetClassroomId' });
    }

    const sourceFolder = await ClassroomFolder.findById(sourceFolderId);
    if (!sourceFolder) {
      return res.status(404).json({ success: false, message: 'Source folder not found' });
    }

    const targetClassroom = await Classroom.findById(targetClassroomId);
    if (!targetClassroom) {
      return res.status(404).json({ success: false, message: 'Target classroom not found' });
    }

    if (!verifyClassroomAccess(targetClassroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // Check if the folder already exists in the target classroom or create a new one
    let targetFolder = await ClassroomFolder.findOne({ classroom: targetClassroomId, name: sourceFolder.name });
    if (!targetFolder) {
      targetFolder = await ClassroomFolder.create({
        name: sourceFolder.name,
        description: sourceFolder.description,
        classroom: targetClassroomId,
        createdBy: req.user._id
      });
    }

    // Fetch recordings to copy
    const recordFilter = { folder: sourceFolderId };
    if (Array.isArray(selectedRecordingIds) && selectedRecordingIds.length > 0) {
      recordFilter._id = { $in: selectedRecordingIds };
    }
    const sourceRecs = await ClassroomRecording.find(recordFilter);
    
    const newRecs = [];
    for (const rec of sourceRecs) {
      // Avoid duplicating if recording with same key/title already exists in this folder in the target classroom
      const exists = await ClassroomRecording.findOne({
        classroom: targetClassroomId,
        folder: targetFolder._id,
        $or: [
          { cloudflareKey: rec.cloudflareKey },
          { title: rec.title }
        ]
      });
      if (exists) continue;

      const newRec = await ClassroomRecording.create({
        classroom: targetClassroomId,
        folder: targetFolder._id,
        title: rec.title,
        description: rec.description,
        uploadedBy: req.user._id,
        storageProvider: rec.storageProvider,
        muxAssetId: rec.muxAssetId,
        muxPlaybackId: rec.muxPlaybackId,
        muxStatus: rec.muxStatus,
        cloudflareKey: rec.cloudflareKey,
        cloudflareUrl: rec.cloudflareUrl,
        duration: rec.duration,
        thumbnail: rec.thumbnail,
        chapters: rec.chapters ? rec.chapters.map(c => ({
          title: c.title,
          startTimeSec: c.startTimeSec,
          order: c.order
        })) : [],
        security: { ...rec.security },
        viewStats: [],
        isPublished: false,
        version: 1
      });
      newRecs.push(newRec);
    }

    await Classroom.findByIdAndUpdate(targetClassroomId, {
      $inc: { 'stats.totalRecordings': newRecs.length }
    });

    res.status(201).json({
      success: true,
      message: 'Folder and selected recordings reused successfully',
      folder: targetFolder,
      recordings: newRecs
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// DYNAMIC /:id ROUTES — must be defined AFTER all static named routes
// =============================================================================

// GET /:id → Get recording detail + signed playback token
router.get('/:id', protect, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id)
      .populate('classroom')
      .populate('uploadedBy', 'fullName');

    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const classroom = await Classroom.findById(recording.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // Generate fresh presigned Cloudflare URL dynamically (valid for 1 hour)
    let cloudflareUrl = undefined;
    if (recording.storageProvider === 'cloudflare' && recording.cloudflareKey) {
      try {
        const { generatePresignedGetUrl } = require('../config/cloudflare');
        cloudflareUrl = await generatePresignedGetUrl(recording.cloudflareKey, 3600);
      } catch (err) {
        console.error('[Cloudflare URL Error] Failed to generate dynamic GET URL:', err);
      }
    }

    res.json({
      success: true,
      recording,
      cloudflareUrl,
      playbackUrl: recording.storageProvider === 'cloudflare'
        ? `/api/v1/recordings/classroom/${recording._id}/stream`
        : undefined
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id/stream → Redirect to a secure presigned Cloudflare R2 GET URL or stream via local proxy
router.get('/:id/stream', protect, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id).lean();
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    const classroom = await Classroom.findById(recording.classroom).lean();
    if (!classroom || !verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (recording.storageProvider !== 'cloudflare' || !recording.cloudflareKey) {
      return res.status(404).json({ success: false, message: 'Stream not available for this recording' });
    }

    const useProxy = req.query.proxy === 'true';

    if (useProxy) {
      const { getS3Client, getCloudflareConfig } = require('../config/cloudflare');
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const client = getS3Client();
      const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();

      const range = req.headers.range;
      const s3Params = {
        Bucket: CLOUDFLARE_R2_BUCKET,
        Key: recording.cloudflareKey,
      };

      if (range) {
        s3Params.Range = range;
      }

      const command = new GetObjectCommand(s3Params);
      const s3Response = await client.send(command);

      // Set headers from S3 response to support proper media range streaming
      res.status(s3Response.$metadata.httpStatusCode || (range ? 206 : 200));

      if (s3Response.ContentType) res.setHeader('Content-Type', s3Response.ContentType);
      if (s3Response.ContentLength) res.setHeader('Content-Length', s3Response.ContentLength);
      if (s3Response.ContentRange) res.setHeader('Content-Range', s3Response.ContentRange);
      if (s3Response.AcceptRanges) res.setHeader('Accept-Ranges', s3Response.AcceptRanges);
      if (s3Response.ETag) res.setHeader('ETag', s3Response.ETag);

      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      return s3Response.Body.pipe(res);
    }

    const { generatePresignedGetUrl } = require('../config/cloudflare');

    // Generate a fresh 1-hour presigned GET URL
    const presignedUrl = await generatePresignedGetUrl(recording.cloudflareKey, 3600);

    // Set CORP header to cross-origin to permit browser to follow redirect in cross-origin environments
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Redirect the browser to the presigned URL
    res.redirect(307, presignedUrl);
  } catch (error) {
    next(error);
  }
});

// GET /:id/progress/my → Student: get my watch progress
router.get('/:id/progress/my', protect, async (req, res, next) => {
  try {
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }
    if (!(await verifyClassroomAccessById(recording.classroom, req.user, false))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }
    const userStats = recording.viewStats.find(
      (v) => v.student.toString() === req.user._id.toString()
    );
    res.json({
      success: true,
      progress: userStats || { totalWatchedSec: 0, lastPosition: 0, rewatchCount: 0 }
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id/analytics → Admin: per-student analytics for a recording
router.get('/:id/analytics', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, false))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    await recording.populate('viewStats.student', 'fullName email avatar');
    res.json({ success: true, viewStats: recording.viewStats });
  } catch (error) {
    next(error);
  }
});

// POST /:id/progress → Student: update watch progress
router.post('/:id/progress', protect, async (req, res, next) => {
  try {
    const { position, watchedSec, completed } = req.body;
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, false))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const safePosition = Math.max(0, Number(position) || 0);
    const safeWatchedSec = Math.min(300, Math.max(0, Number(watchedSec) || 0));
    const isCompleted = !!completed || (recording.duration > 0 && safePosition >= recording.duration * 0.9);

    let userStatsIndex = recording.viewStats.findIndex(
      (v) => v.student.toString() === req.user._id.toString()
    );

    if (userStatsIndex === -1) {
      recording.viewStats.push({
        student: req.user._id,
        totalWatchedSec: safeWatchedSec,
        lastPosition: safePosition,
        rewatchCount: isCompleted ? 1 : 0,
        completedAt: isCompleted ? new Date() : null,
        sessions: [{
          startedAt: new Date(Date.now() - safeWatchedSec * 1000),
          endedAt: new Date(),
          watchedSec: safeWatchedSec
        }]
      });
      userStatsIndex = recording.viewStats.length - 1;
    } else {
      const stats = recording.viewStats[userStatsIndex];
      stats.lastPosition = safePosition;
      stats.totalWatchedSec += safeWatchedSec;
      if (isCompleted && !stats.completedAt) {
        stats.completedAt = new Date();
        stats.rewatchCount += 1;
      }
      stats.sessions.push({
        startedAt: new Date(Date.now() - safeWatchedSec * 1000),
        endedAt: new Date(),
        watchedSec: safeWatchedSec
      });
    }

    await recording.save();
    res.json({
      success: true,
      message: 'Watch progress updated',
      progress: recording.viewStats[userStatsIndex]
    });
  } catch (error) {
    next(error);
  }
});

// POST /:id/chapters → Admin: save chapters
router.post('/:id/chapters', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const { chapters } = req.body;
    recording.chapters = chapters;
    await recording.save();
    res.json({ success: true, message: 'Chapters updated successfully', recording });
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin/Faculty: update title, description, chapters
router.put('/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    Object.assign(recording, req.body);
    await recording.save();
    res.json({ success: true, message: 'Recording updated successfully', recording });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/publish → Admin/Faculty: publish recording + notify students
router.put('/:id/publish', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    recording.isPublished = true;
    recording.notified = true;
    recording.notifiedAt = new Date();
    await recording.save();

    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`classroom:${recording.classroom}`).emit('recording:published', {
        recordingId: recording._id,
        title: recording.title
      });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit recording published alert:', socketErr.message);
    }

    res.json({ success: true, message: 'Recording published and students notified' });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin/Faculty: delete recording
router.delete('/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    }
    const recording = await ClassroomRecording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    if (!(await verifyClassroomAccessById(recording.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    await Classroom.findByIdAndUpdate(recording.classroom, {
      $inc: { 'stats.totalRecordings': -1 }
    });

    if (recording.cloudflareKey) {
      const LibraryRecording = require('../models/LibraryRecording');
      const libraryCount = await LibraryRecording.countDocuments({ cloudflareKey: recording.cloudflareKey });
      const classroomCount = await ClassroomRecording.countDocuments({ cloudflareKey: recording.cloudflareKey });

      // If no library recording references this key, and it's only in this classroom (count <= 1), delete from R2
      if (libraryCount === 0 && classroomCount <= 1) {
        await deleteFileFromCloudflareR2(recording.cloudflareKey).catch(err => {
          console.error(`[R2 Delete Error] Failed to delete key ${recording.cloudflareKey}:`, err);
        });
      }
    }

    await recording.deleteOne();
    res.json({ success: true, message: 'Recording deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
