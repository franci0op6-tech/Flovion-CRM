
import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;
  const accountId = process.env.R2_ACCOUNT_ID;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !endpoint
  ) {
    throw new Error(
      "Cloudflare R2 non configurato. Operazione storage non disponibile."
    );
  }

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return client;
}

export const r2BucketName = process.env.R2_BUCKET_NAME ?? "";

export const r2: Pick<S3Client, "send"> = {
  send: ((...args: unknown[]) => {
    const sender = getR2Client().send as (
      ...parameters: unknown[]
    ) => unknown;

    return sender.apply(getR2Client(), args);
  }) as S3Client["send"],
};
