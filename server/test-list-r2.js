const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET;
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

const client = new S3Client({
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  region: 'auto',
  forcePathStyle: true,
});

async function checkFile(key) {
  try {
    const res = await client.send(new HeadObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET,
      Key: key,
    }));
    console.log(`File "${key}" exists! Metadata:`, res);
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`File "${key}" does not exist (404).`);
      return false;
    }
    console.error(`Error checking file "${key}":`, err);
    throw err;
  }
}

async function listFiles() {
  try {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: CLOUDFLARE_R2_BUCKET,
      MaxKeys: 100,
    }));
    console.log('Files in bucket:');
    if (res.Contents) {
      res.Contents.forEach(item => {
        console.log(`- ${item.Key} (${item.Size} bytes)`);
      });
    } else {
      console.log('No files found.');
    }
  } catch (err) {
    console.error('Error listing files:', err);
  }
}

async function run() {
  const testKey = 'global-library/1783964680113-faculty.mp4';
  await checkFile(testKey);
  await listFiles();
}

run();
