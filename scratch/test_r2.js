require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testR2() {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    console.log('Testing R2 Upload...');
    console.log('Account:', accountId);
    console.log('Bucket:', bucketName);

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test/upload.txt',
      Body: Buffer.from('Hello R2'),
      ContentType: 'text/plain',
    });

    const res = await client.send(command);
    console.log('Success:', res);
  } catch (error) {
    console.error('Error:', error);
  }
}

testR2();
