import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  console.log('Testing R2 with Account:', accountId);
  if (!accountId) {
    console.error('Missing env vars');
    return;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test/test.txt',
      Body: Buffer.from('hello'),
      ContentType: 'text/plain',
    });
    const res = await client.send(command);
    console.log('R2 Upload Success:', res.$metadata.httpStatusCode);
  } catch (error) {
    console.error('R2 Upload Error:', error);
  }
}

main();
