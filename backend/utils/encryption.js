const crypto = require('crypto');
const logger = require('../services/logger');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is 12 bytes, but we'll use 16 for compatibility
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Generate a random encryption key
 * @returns {Buffer} Random encryption key
 */
const generateKey = () => {
  return crypto.randomBytes(32);
};

/**
 * Derive key from password using PBKDF2
 * @param {string} password - Password to derive key from
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string|Object} data - Data to encrypt
 * @param {string} key - Encryption key (hex string or Buffer)
 * @returns {Object} Encrypted data with metadata
 */
const encrypt = (data, key = process.env.VOTE_ENCRYPTION_KEY) => {
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Convert key to Buffer if it's a string
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    
    // Create cipher
    const cipher = crypto.createCipher(ALGORITHM, keyBuffer);
    
    // Encrypt data
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Return encrypted data with metadata
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM
    };
    
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-256-GCM
 * @param {Object} encryptedData - Encrypted data object
 * @param {string} key - Decryption key (hex string or Buffer)
 * @returns {string} Decrypted data
 */
const decrypt = (encryptedData, key = process.env.VOTE_ENCRYPTION_KEY) => {
  try {
    // Handle legacy encrypted strings (simple base64 encoding)
    if (typeof encryptedData === 'string') {
      return decryptLegacy(encryptedData, key);
    }
    
    // Convert key to Buffer if it's a string
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    
    // Convert hex strings to Buffer
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipher(ALGORITHM, keyBuffer);
    
    // Set authentication tag
    decipher.setAuthTag(tag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Decrypt legacy encrypted data (simple base64)
 * @param {string} encryptedString - Legacy encrypted string
 * @param {string} key - Decryption key
 * @returns {string} Decrypted data
 */
const decryptLegacy = (encryptedString, key) => {
  try {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    const encryptedBuffer = Buffer.from(encryptedString, 'base64');
    
    // Simple XOR decryption for legacy data
    const decryptedBuffer = Buffer.alloc(encryptedBuffer.length);
    for (let i = 0; i < encryptedBuffer.length; i++) {
      decryptedBuffer[i] = encryptedBuffer[i] ^ keyBuffer[i % keyBuffer.length];
    }
    
    return decryptedBuffer.toString('utf8');
  } catch (error) {
    logger.error('Legacy decryption error:', error);
    throw new Error('Failed to decrypt legacy data');
  }
};

/**
 * Encrypt data for database storage (with salt)
 * @param {string|Object} data - Data to encrypt
 * @param {string} password - Password for encryption
 * @returns {Object} Encrypted data ready for database storage
 */
const encryptForStorage = (data, password) => {
  try {
    // Generate random salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive key from password and salt
    const key = deriveKey(password, salt);
    
    // Encrypt data
    const encrypted = encrypt(data, key);
    
    return {
      encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      tag: encrypted.tag,
      salt: salt.toString('hex'),
      algorithm: ALGORITHM
    };
    
  } catch (error) {
    logger.error('Storage encryption error:', error);
    throw new Error('Failed to encrypt data for storage');
  }
};

/**
 * Decrypt data from database storage
 * @param {Object} encryptedData - Encrypted data from database
 * @param {string} password - Password for decryption
 * @returns {string} Decrypted data
 */
const decryptFromStorage = (encryptedData, password) => {
  try {
    // Convert hex strings to Buffer
    const salt = Buffer.from(encryptedData.salt, 'hex');
    
    // Derive key from password and salt
    const key = deriveKey(password, salt);
    
    // Decrypt data
    return decrypt({
      encrypted: encryptedData.encrypted,
      iv: encryptedData.iv,
      tag: encryptedData.tag
    }, key);
    
  } catch (error) {
    logger.error('Storage decryption error:', error);
    throw new Error('Failed to decrypt data from storage');
  }
};

/**
 * Hash data using SHA-256
 * @param {string|Object} data - Data to hash
 * @returns {string} SHA-256 hash
 */
const hash = (data) => {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

/**
 * Generate HMAC signature
 * @param {string|Object} data - Data to sign
 * @param {string} secret - Secret key for HMAC
 * @returns {string} HMAC signature
 */
const sign = (data, secret = process.env.AUDIT_ENCRYPTION_KEY) => {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {string|Object} data - Data to verify
 * @param {string} signature - Signature to verify against
 * @param {string} secret - Secret key for HMAC
 * @returns {boolean} True if signature is valid
 */
const verify = (data, signature, secret = process.env.AUDIT_ENCRYPTION_KEY) => {
  const expectedSignature = sign(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

/**
 * Generate a secure random string
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a secure random number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
const generateRandomNumber = (min = 0, max = 1000000) => {
  return crypto.randomInt(min, max + 1);
};

/**
 * Encrypt sensitive user data
 * @param {Object} userData - User data to encrypt
 * @returns {Object} Encrypted user data
 */
const encryptUserData = (userData) => {
  const encryptedData = {};
  
  // Fields to encrypt
  const sensitiveFields = [
    'firstName',
    'lastName',
    'phoneNumber',
    'address',
    'voterId'
  ];
  
  Object.keys(userData).forEach(key => {
    if (sensitiveFields.includes(key) && userData[key]) {
      encryptedData[key] = encrypt(userData[key]);
    } else {
      encryptedData[key] = userData[key];
    }
  });
  
  return encryptedData;
};

/**
 * Decrypt sensitive user data
 * @param {Object} encryptedUserData - Encrypted user data
 * @returns {Object} Decrypted user data
 */
const decryptUserData = (encryptedUserData) => {
  const decryptedData = {};
  
  // Fields to decrypt
  const sensitiveFields = [
    'firstName',
    'lastName',
    'phoneNumber',
    'address',
    'voterId'
  ];
  
  Object.keys(encryptedUserData).forEach(key => {
    if (sensitiveFields.includes(key) && encryptedUserData[key]) {
      try {
        decryptedData[key] = decrypt(encryptedUserData[key]);
      } catch (error) {
        logger.error(`Failed to decrypt field ${key}:`, error);
        decryptedData[key] = encryptedUserData[key]; // Return original if decryption fails
      }
    } else {
      decryptedData[key] = encryptedUserData[key];
    }
  });
  
  return decryptedData;
};

/**
 * Encrypt vote data with additional security
 * @param {Object} voteData - Vote data to encrypt
 * @returns {Object} Encrypted vote data
 */
const encryptVoteData = (voteData) => {
  try {
    // Add timestamp and random salt for additional security
    const enhancedVoteData = {
      ...voteData,
      timestamp: Date.now(),
      salt: generateRandomString(16)
    };
    
    // Encrypt the vote data
    const encrypted = encrypt(enhancedVoteData);
    
    // Generate hash for integrity verification
    const voteHash = hash(enhancedVoteData);
    
    return {
      encryptedVote: encrypted.encrypted,
      encryptionKey: encrypted.iv, // Use IV as key identifier
      hash: voteHash,
      algorithm: ALGORITHM
    };
    
  } catch (error) {
    logger.error('Vote encryption error:', error);
    throw new Error('Failed to encrypt vote data');
  }
};

/**
 * Decrypt vote data
 * @param {Object} encryptedVoteData - Encrypted vote data
 * @returns {Object} Decrypted vote data
 */
const decryptVoteData = (encryptedVoteData) => {
  try {
    const decrypted = decrypt({
      encrypted: encryptedVoteData.encryptedVote,
      iv: encryptedVoteData.encryptionKey,
      tag: '', // Tag not used in this implementation
      algorithm: encryptedVoteData.algorithm || ALGORITHM
    });
    
    // Verify hash for integrity
    const voteHash = hash(decrypted);
    if (voteHash !== encryptedVoteData.hash) {
      throw new Error('Vote data integrity check failed');
    }
    
    return decrypted;
    
  } catch (error) {
    logger.error('Vote decryption error:', error);
    throw new Error('Failed to decrypt vote data');
  }
};

module.exports = {
  generateKey,
  deriveKey,
  encrypt,
  decrypt,
  encryptForStorage,
  decryptFromStorage,
  hash,
  sign,
  verify,
  generateRandomString,
  generateRandomNumber,
  encryptUserData,
  decryptUserData,
  encryptVoteData,
  decryptVoteData
};
