const fs = require('fs');
let code = fs.readFileSync('server/src/routes/recordings.js', 'utf8');

const additions = `
// POST /presigned-url
router.post('/presigned-url', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'filename is required' });
    const safeName = filename.replace(/[/\\\\]/g, '_');
    const objectKey = \`global-library/\${Date.now()}-\${safeName}\`;
    const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(objectKey, contentType || 'video/mp4', 3600);
    res.json({ success: true, uploadUrl, objectKey, publicUrl });
  } catch (error) { next(error); }
});

// POST /save-recording
router.post('/save-recording', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { title, description, duration, folderId, objectKey, publicUrl } = req.body;
    if (!title || !objectKey) return res.status(400).json({ success: false, message: 'Title and objectKey are required' });
    
    const recording = await LibraryRecording.create({
      title,
      description,
      uploadedBy: req.user._id,
      folder: folderId ? folderId : null,
      storageProvider: 'cloudflare',
      cloudflareKey: objectKey,
      cloudflareUrl: publicUrl,
      duration: duration ? parseInt(duration, 10) : 0,
      thumbnail: '/default-video-thumb.jpg'
    });
    res.status(201).json({ success: true, message: 'Recording saved', recording });
  } catch (error) { next(error); }
});

// MULTIPART
router.post('/multipart/initiate', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'filename required' });
    const safeName = filename.replace(/[/\\\\]/g, '_');
    const objectKey = \`global-library/\${Date.now()}-\${safeName}\`;
    const uploadId = await createMultipartUpload(objectKey, contentType || 'video/mp4');
    const { getR2ObjectUrl } = require('../config/cloudflare');
    res.json({ success: true, uploadId, objectKey, publicUrl: getR2ObjectUrl(objectKey) });
  } catch (error) { next(error); }
});

router.post('/multipart/presign-part', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { objectKey, uploadId, partNumber } = req.body;
    if (!objectKey || !uploadId || partNumber == null) return res.status(400).json({ success: false, message: 'Missing params' });
    const presignedUrl = await generatePresignedPartUrl(objectKey, uploadId, parseInt(partNumber, 10), 7200);
    res.json({ success: true, presignedUrl });
  } catch (error) { next(error); }
});

router.post('/multipart/complete', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { objectKey, uploadId, parts } = req.body;
    if (!objectKey || !uploadId || !Array.isArray(parts)) return res.status(400).json({ success: false, message: 'Missing params' });
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    const publicUrl = await completeMultipartUpload(objectKey, uploadId, sortedParts);
    res.json({ success: true, publicUrl });
  } catch (error) { next(error); }
});

router.post('/multipart/abort', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { objectKey, uploadId } = req.body;
    if (!objectKey || !uploadId) return res.status(400).json({ success: false, message: 'Missing params' });
    await abortMultipartUpload(objectKey, uploadId);
    res.json({ success: true });
  } catch (error) { next(error); }
});
`;
if (!code.includes('/multipart/initiate')) {
  code = code.replace('module.exports = router;', additions + '\nmodule.exports = router;');
  fs.writeFileSync('server/src/routes/recordings.js', code);
  console.log('patched backend');
}

// Now patch client/src/lib/api.ts
let apiCode = fs.readFileSync('client/src/lib/api.ts', 'utf8');

const apiAdditions = `
export async function uploadLibraryRecordingToCloudflare({
  file,
  folderId,
  title,
  description = '',
  duration = 0,
  onProgress,
}: {
  file: File;
  folderId?: string;
  title: string;
  description?: string;
  duration?: number;
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percentage: number;
    part?: number;       
    totalParts?: number; 
  }) => void;
}) {
  const authHeaders = getDevAuthUserHeaders();
  const accessToken = classroomStore.getState().accessToken;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: \`Bearer \${accessToken}\` } : {}),
    ...authHeaders,
  };

  const reportProgress = (loaded: number, total: number, part?: number, totalParts?: number) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      ...(part != null ? { part, totalParts } : {}),
    });
  };

  if (file.size < MULTIPART_CHUNK_SIZE) {
    const presignRes = await fetch(\`\${API_BASE}/recordings/presigned-url\`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
    });

    const presignData = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok) throw new Error(presignData.message || 'Failed to get upload URL');

    const { uploadUrl, objectKey, publicUrl } = presignData as any;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) reportProgress(e.loaded, e.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          reportProgress(file.size, file.size);
          resolve();
        } else {
          reject(new Error(\`R2 upload failed: HTTP \${xhr.status}\`));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      xhr.send(file);
    });

    const saveRes = await fetch(\`\${API_BASE}/recordings/save-recording\`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) throw new Error(saveData.message || 'Failed to save recording metadata');
    return saveData;
  }

  const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
  const initiateRes = await fetch(\`\${API_BASE}/recordings/multipart/initiate\`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
  });
  const initiateData = await initiateRes.json().catch(() => ({}));
  if (!initiateRes.ok) throw new Error(initiateData.message || 'Failed to initiate multipart upload');

  const { uploadId, objectKey, publicUrl } = initiateData as any;
  const parts: { ETag: string; PartNumber: number }[] = [];
  let uploadedBytes = 0;

  try {
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_CHUNK_SIZE;
      const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const presignRes = await fetch(\`\${API_BASE}/recordings/multipart/presign-part\`, {
        method: 'POST',
        credentials: 'include',
        headers: baseHeaders,
        body: JSON.stringify({ objectKey, uploadId, partNumber }),
      });
      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) throw new Error(presignData.message || 'Failed to presign part');

      const etag = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignData.presignedUrl, true);
        let lastLoaded = 0;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const diff = e.loaded - lastLoaded;
            lastLoaded = e.loaded;
            uploadedBytes += diff;
            reportProgress(uploadedBytes, file.size, partNumber, totalParts);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const returnedEtag = xhr.getResponseHeader('ETag');
            if (returnedEtag) resolve(returnedEtag.replace(/"/g, ''));
            else resolve('');
          } else {
            reject(new Error(\`Part \${partNumber} upload failed: HTTP \${xhr.status}\`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.send(chunk);
      });

      parts.push({ ETag: etag, PartNumber: partNumber });
    }

    const completeRes = await fetch(\`\${API_BASE}/recordings/multipart/complete\`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId, parts }),
    });
    const completeData = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) throw new Error(completeData.message || 'Failed to complete multipart upload');

    const saveRes = await fetch(\`\${API_BASE}/recordings/save-recording\`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) throw new Error(saveData.message || 'Failed to save recording metadata');
    return saveData;

  } catch (error) {
    await fetch(\`\${API_BASE}/recordings/multipart/abort\`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId }),
    }).catch(console.error);
    throw error;
  }
}
`;
if (!apiCode.includes('uploadLibraryRecordingToCloudflare')) {
  apiCode += '\n' + apiAdditions;
  fs.writeFileSync('client/src/lib/api.ts', apiCode);
  console.log('patched api');
}
