import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function clearR2() {
  const bucketName = process.env.R2_BUCKET_NAME;
  console.log(`Listing objects in bucket: ${bucketName}`);

  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);
    const objects = response.Contents;

    if (objects && objects.length > 0) {
      console.log(`Deleting ${objects.length} objects...`);
      const deleteParams = {
        Bucket: bucketName,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key })),
        },
      };

      await s3Client.send(new DeleteObjectsCommand(deleteParams));
    }

    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  console.log("R2 bucket cleared successfully.");
}

clearR2().catch(console.error);
