import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'bridge.db'),
  midtransSnapUrl: process.env.MIDTRANS_SNAP_URL || 'https://app.sandbox.midtrans.com/snap/v1/transactions',
  nodeEnv: process.env.NODE_ENV || 'development',
  get isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
};
