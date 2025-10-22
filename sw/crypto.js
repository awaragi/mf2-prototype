import { KEY_VERSION, CRYPTO_ALGORITHM, KEY_LENGTH, IV_LENGTH, TAG_LENGTH } from './constants.js';
import { logger } from '../js-common/utils/logging.js';

const logPrefix = '[CRYPTO]';

// Cache for derived keys to avoid re-deriving
const keyCache = new Map();

/**
 * Initialize WebCrypto and verify support
 */
export async function initCrypto() {
  try {
    if (!crypto?.subtle) {
      throw new Error('WebCrypto not available');
    }

    // Test basic functionality
    const testKey = await generateKey();
    const testData = new TextEncoder().encode('test');
    const encrypted = await encrypt(testData, KEY_VERSION);
    const decrypted = await decrypt(encrypted);

    if (new TextDecoder().decode(decrypted) !== 'test') {
      throw new Error('Crypto roundtrip failed');
    }

      logger.info(logPrefix, 'WebCrypto OK');
      return true;
  } catch (error) {
      logger.error(logPrefix, 'Initialization failed:', error);
      throw error;
  }
}

/**
 * Generate a new AES-GCM key for encryption
 */
async function generateKey() {
  return await crypto.subtle.generateKey(
    {
      name: CRYPTO_ALGORITHM,
      length: KEY_LENGTH
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create a key for the specified version
 */
async function getKeyForVersion(keyVersion) {
  if (!keyCache.has(keyVersion)) {
    const key = await generateKey();
    keyCache.set(keyVersion, key);
  }
  return keyCache.get(keyVersion);
}

/**
 * Generate a random IV for encryption
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypt plaintext bytes using AES-GCM
 * @param {ArrayBuffer|Uint8Array} plainBytes - Data to encrypt
 * @param {number} keyVersion - Key version to use
 * @param {string} type - MIME type for reconstruction
 * @returns {Object} Encrypted object with {iv, ct, type, keyVersion}
 */
export async function encrypt(plainBytes, keyVersion = KEY_VERSION, type = 'application/octet-stream') {
  try {
    const key = await getKeyForVersion(keyVersion);
    const iv = generateIV();

    // Convert to ArrayBuffer if needed
    const data = plainBytes instanceof ArrayBuffer ? plainBytes : plainBytes.buffer;

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: CRYPTO_ALGORITHM,
        iv: iv,
        tagLength: TAG_LENGTH
      },
      key,
      data
    );

      logger.info(logPrefix, `Encrypt → ${data.byteLength} bytes`);

      return {
      iv: Array.from(iv), // Store as array for JSON serialization
      ct: Array.from(new Uint8Array(ciphertext)),
      type: type,
      keyVersion: keyVersion
    };
  } catch (error) {
      logger.error(logPrefix, 'Encryption failed:', error);
      throw error;
  }
}

/**
 * Decrypt ciphertext using AES-GCM
 * @param {Object} encryptedData - Object with {iv, ct, type, keyVersion}
 * @returns {ArrayBuffer} Decrypted data
 */
export async function decrypt(encryptedData) {
  try {
    const { iv, ct, type, keyVersion } = encryptedData;

    if (!iv || !ct || !keyVersion) {
      throw new Error('Invalid encrypted data structure');
    }

    const key = await getKeyForVersion(keyVersion);
    const ivArray = new Uint8Array(iv);
    const ctArray = new Uint8Array(ct);

    const plaintext = await crypto.subtle.decrypt(
      {
        name: CRYPTO_ALGORITHM,
        iv: ivArray,
        tagLength: TAG_LENGTH
      },
      key,
      ctArray
    );

      logger.info(logPrefix, `Decrypt → ${type} (${plaintext.byteLength} bytes)`);

      return plaintext;
  } catch (error) {
      logger.error(logPrefix, 'Decryption failed:', error);
      return null;
  }
}

/**
 * Create a Blob from decrypted data
 * @param {ArrayBuffer} data - Decrypted data
 * @param {string} type - MIME type
 * @returns {Blob}
 */
export function createBlobFromDecrypted(data, type) {
  return new Blob([data], { type });
}

/**
 * Clear crypto keys from memory (for security)
 */
export function clearKeys() {
  keyCache.clear();
    logger.info(logPrefix, 'Keys cleared from memory');
}
