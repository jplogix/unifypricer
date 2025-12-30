import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // StreetPricer API
  streetPricer: {
    apiUrl: process.env.STREETPRICER_API_URL || 'https://api.streetpricer.com/api/v1',
    apiKey: process.env.STREETPRICER_API_KEY || '',
    apiSecret: process.env.STREETPRICER_API_SECRET || '',
    storesEndpoint: process.env.STREETPRICER_STORES_ENDPOINT || '/stores',
    productsEndpoint: process.env.STREETPRICER_PRODUCTS_ENDPOINT || '/products',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  // Database
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/price-sync.db'),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Sync
  sync: {
    defaultInterval: parseInt(process.env.DEFAULT_SYNC_INTERVAL || '60', 10),
  },
};

// Validate required configuration
export function validateConfig(): void {
  const required = [
    { key: 'ENCRYPTION_KEY', value: config.encryption.key },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }

  // Validate encryption key length (should be 32 bytes hex = 64 characters)
  if (config.encryption.key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
}
