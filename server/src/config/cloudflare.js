const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

dotenv.config();

function getCloudflareConfig() {
  return {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET,
    CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.Access_Key_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env['Secret Access Key'],
  };
}

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY
  } = getCloudflareConfig();

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 is not fully configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.');
  }

  s3Client = new S3Client({
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
    region: 'auto',
    forcePathStyle: true,
  });

  return s3Client;
}

function getR2ObjectUrl(objectKey) {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const formattedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${CLOUDFLARE_R2_BUCKET}/${formattedKey}`;
}

// ✅ Accepts Buffer (memoryStorage) or file path (legacy)
async function uploadFileToCloudflareR2(filePathOrBuffer, objectKey, contentType) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  const body = Buffer.isBuffer(filePathOrBuffer)
    ? filePathOrBuffer
    : fs.createReadStream(filePathOrBuffer);

  await client.send(new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  }));

  return {
    objectKey,
    url: getR2ObjectUrl(objectKey),
  };
}

async function deleteFileFromCloudflareR2(objectKey) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET,
      Key: objectKey,
    }));
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return true;
    }
    throw error;
  }

  return true;
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to R2.
 * The file never passes through Railway — eliminates timeout issues entirely.
 *
 * @param {string} objectKey  - R2 object key (path inside the bucket)
 * @param {string} contentType - MIME type of the file being uploaded
 * @param {number} expiresIn   - Seconds until the URL expires (default 3600 = 1h)
 * @returns {{ uploadUrl: string, objectKey: string, publicUrl: string }}
 */
async function generatePresignedUploadUrl(objectKey, contentType, expiresIn = 3600) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
    ContentType: contentType || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    objectKey,
    publicUrl: getR2ObjectUrl(objectKey),
  };
}

// ─── Multipart upload helpers (for files > 100 MB) ───────────────────────────

/**
 * Initiate a multipart upload and return the UploadId.
 * @param {string} objectKey  - R2 object key
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} uploadId
 */
async function createMultipartUpload(objectKey, contentType) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  const result = await client.send(new CreateMultipartUploadCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
    ContentType: contentType || 'video/mp4',
  }));

  return result.UploadId;
}

/**
 * Generate a presigned PUT URL for a single part of a multipart upload.
 * Each URL is valid for 2 hours — enough for a 100 MB chunk on a slow connection.
 *
 * @param {string} objectKey  - R2 object key
 * @param {string} uploadId   - UploadId returned by createMultipartUpload
 * @param {number} partNumber - 1-based part index (1–10 000)
 * @param {number} expiresIn  - Seconds until the URL expires (default 7200 = 2h)
 * @returns {Promise<string>} presigned PUT URL
 */
async function generatePresignedPartUrl(objectKey, uploadId, partNumber, expiresIn = 7200) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  const command = new UploadPartCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Tell R2 to assemble all uploaded parts into the final object.
 *
 * @param {string} objectKey - R2 object key
 * @param {string} uploadId  - UploadId from createMultipartUpload
 * @param {{ PartNumber: number; ETag: string }[]} parts - Sorted list of completed parts
 * @returns {Promise<string>} Public URL of the assembled object
 */
async function completeMultipartUpload(objectKey, uploadId, parts) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  await client.send(new CompleteMultipartUploadCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));

  return getR2ObjectUrl(objectKey);
}

/**
 * Abort an in-progress multipart upload to free incomplete part storage.
 * Called automatically by the server if the browser reports a failure.
 *
 * @param {string} objectKey - R2 object key
 * @param {string} uploadId  - UploadId to abort
 */
async function abortMultipartUpload(objectKey, uploadId) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  try {
    await client.send(new AbortMultipartUploadCommand({
      Bucket: CLOUDFLARE_R2_BUCKET,
      Key: objectKey,
      UploadId: uploadId,
    }));
  } catch (err) {
    // Log but don't throw — abort is best-effort cleanup
    console.error('[R2] Failed to abort multipart upload:', err.message);
  }
}

/**
 * Generate a presigned GET URL so the browser can stream / download an object
 * directly from R2 without exposing the S3 API credentials.
 *
 * @param {string} objectKey  - R2 object key (path inside the bucket)
 * @param {number} expiresIn   - Seconds until the URL expires (default 604800 = 7 days)
 * @returns {Promise<string>} presigned GET URL
 */
async function generatePresignedGetUrl(objectKey, expiresIn = 604800) {
  const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET,
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

module.exports = {
  getR2ObjectUrl,
  uploadFileToCloudflareR2,
  deleteFileFromCloudflareR2,
  generatePresignedUploadUrl,
  generatePresignedGetUrl,
  // Multipart helpers
  createMultipartUpload,
  generatePresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  getS3Client,
  getCloudflareConfig,
  fetchFn: typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
};
