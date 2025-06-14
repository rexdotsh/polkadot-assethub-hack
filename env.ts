import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    PINATA_JWT: z.string().min(1),
    CONVEX_DEPLOYMENT: z.string().min(1).optional(),
    // necessary only for prod on vercel
    CONVEX_DEPLOY_KEY: z.string().min(1).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_CONTRACT_ADDRESS: z.string().min(1),
    NEXT_PUBLIC_GATEWAY_URL: z.string().min(1),
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    PINATA_JWT: process.env.PINATA_JWT,
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  },
});
