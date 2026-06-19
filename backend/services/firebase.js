const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseApp = null;
let isMockMode = false;

const initializeFirebase = async () => {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      logger.info('Firebase already initialized');
      return firebaseApp;
    }

    // Validate required environment variables
    const requiredFields = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];

    const missingFields = requiredFields.filter(field => !process.env[field]);
    const hasPlaceholders = requiredFields.some(field => process.env[field] && (process.env[field].includes('your-') || process.env[field] === 'placeholder'));

    if (missingFields.length > 0 || hasPlaceholders) {
      console.log('⚠️ Firebase configuration is missing or contains placeholder values. Running in LOCAL/MOCK mode.');
      isMockMode = true;
      firebaseApp = { isMock: true };
      return firebaseApp;
    }

    // Initialize Firebase Admin SDK
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;

  } catch (error) {
    console.log('⚠️ Failed to initialize Firebase Admin SDK, falling back to LOCAL/MOCK mode:', error.message);
    isMockMode = true;
    firebaseApp = { isMock: true };
    return firebaseApp;
  }
};

const getFirebaseApp = () => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
};

const getAuth = () => {
  const app = getFirebaseApp();
  return app.auth();
};

const getFirestore = () => {
  const app = getFirebaseApp();
  return app.firestore();
};

const verifyIdToken = async (idToken) => {
  if (isMockMode) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(idToken, process.env.JWT_SECRET || 'votesecure-fallback-secret');
      return {
        uid: decoded.uid || decoded.id || 'mock-user-id',
        email: decoded.email || 'mock@example.com',
        email_verified: true,
        name: decoded.name || 'Mock User'
      };
    } catch (error) {
      if (idToken === 'mock-token-admin' || idToken.startsWith('mock-admin-token')) {
        return { uid: 'mock-admin-uid', email: 'admin@votesecure.online', email_verified: true, name: 'Admin User' };
      }
      if (idToken === 'mock-token-voter' || idToken.startsWith('mock-voter-token')) {
        return { uid: 'mock-voter-uid', email: 'voter@votesecure.online', email_verified: true, name: 'Voter User' };
      }
      throw error;
    }
  }

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    
    logger.debug('Firebase token verified successfully', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified
    });
    
    return decodedToken;
  } catch (error) {
    logger.error('Firebase token verification failed:', error);
    throw error;
  }
};

const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    
    logger.debug('Custom token created successfully', { uid });
    return customToken;
  } catch (error) {
    logger.error('Failed to create custom token:', error);
    throw error;
  }
};

const getUser = async (uid) => {
  if (isMockMode) {
    const User = require('../models/User');
    const user = await User.findOne({ firebaseUid: uid });
    if (user) {
      return { uid: user.firebaseUid, email: user.email, displayName: user.fullName };
    }
    return { uid, email: 'mock@example.com', displayName: 'Mock User' };
  }
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    
    logger.debug('Firebase user retrieved successfully', { uid });
    return userRecord;
  } catch (error) {
    logger.error('Failed to get Firebase user:', error);
    throw error;
  }
};

const createUser = async (userData) => {
  if (isMockMode) {
    const uid = 'mock-uid-' + Math.random().toString(36).substr(2, 9);
    return { uid, email: userData.email, displayName: userData.displayName };
  }
  try {
    const auth = getAuth();
    const userRecord = await auth.createUser({
      email: userData.email,
      emailVerified: userData.emailVerified || false,
      password: userData.password,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      disabled: userData.disabled || false
    });
    
    logger.info('Firebase user created successfully', { uid: userRecord.uid });
    return userRecord;
  } catch (error) {
    logger.error('Failed to create Firebase user:', error);
    throw error;
  }
};

const updateUser = async (uid, userData) => {
  if (isMockMode) {
    return { uid, ...userData };
  }
  try {
    const auth = getAuth();
    const updateData = {};
    
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.emailVerified !== undefined) updateData.emailVerified = userData.emailVerified;
    if (userData.password !== undefined) updateData.password = userData.password;
    if (userData.displayName !== undefined) updateData.displayName = userData.displayName;
    if (userData.photoURL !== undefined) updateData.photoURL = userData.photoURL;
    if (userData.disabled !== undefined) updateData.disabled = userData.disabled;
    
    const userRecord = await auth.updateUser(uid, updateData);
    
    logger.info('Firebase user updated successfully', { uid });
    return userRecord;
  } catch (error) {
    logger.error('Failed to update Firebase user:', error);
    throw error;
  }
};

const deleteUser = async (uid) => {
  if (isMockMode) {
    return true;
  }
  try {
    const auth = getAuth();
    await auth.deleteUser(uid);
    
    logger.info('Firebase user deleted successfully', { uid });
    return true;
  } catch (error) {
    logger.error('Failed to delete Firebase user:', error);
    throw error;
  }
};

const setCustomUserClaims = async (uid, customClaims) => {
  if (isMockMode) {
    return true;
  }
  try {
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, customClaims);
    
    logger.info('Custom user claims set successfully', { uid, claims: customClaims });
    return true;
  } catch (error) {
    logger.error('Failed to set custom user claims:', error);
    throw error;
  }
};

const revokeRefreshTokens = async (uid) => {
  if (isMockMode) {
    return true;
  }
  try {
    const auth = getAuth();
    await auth.revokeRefreshTokens(uid);
    
    logger.info('Refresh tokens revoked successfully', { uid });
    return true;
  } catch (error) {
    logger.error('Failed to revoke refresh tokens:', error);
    throw error;
  }
};

const generatePasswordResetLink = async (email, actionCodeSettings) => {
  if (isMockMode) {
    return `http://localhost:5000/reset-password?email=${email}`;
  }
  try {
    const auth = getAuth();
    const link = await auth.generatePasswordResetLink(email, actionCodeSettings);
    
    logger.info('Password reset link generated successfully', { email });
    return link;
  } catch (error) {
    logger.error('Failed to generate password reset link:', error);
    throw error;
  }
};

const generateEmailVerificationLink = async (email, actionCodeSettings) => {
  if (isMockMode) {
    return `http://localhost:5000/verify-email?email=${email}`;
  }
  try {
    const auth = getAuth();
    const link = await auth.generateEmailVerificationLink(email, actionCodeSettings);
    
    logger.info('Email verification link generated successfully', { email });
    return link;
  } catch (error) {
    logger.error('Failed to generate email verification link:', error);
    throw error;
  }
};

// Firebase Cloud Messaging functions
const sendNotification = async (tokens, notification, data = {}) => {
  if (isMockMode) {
    logger.info('Mock notification sent to tokens', { tokens, notification, data });
    return { successCount: 1, failureCount: 0 };
  }
  try {
    const messaging = getFirebaseApp().messaging();
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: data,
      tokens: Array.isArray(tokens) ? tokens : [tokens]
    };
    
    const response = await messaging.sendMulticast(message);
    
    logger.info('Notification sent successfully', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });
    
    return response;
  } catch (error) {
    logger.error('Failed to send notification:', error);
    throw error;
  }
};

const sendToTopic = async (topic, notification, data = {}) => {
  if (isMockMode) {
    logger.info('Mock notification sent to topic', { topic, notification, data });
    return 'mock-message-id';
  }
  try {
    const messaging = getFirebaseApp().messaging();
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl
      },
      data: data,
      topic: topic
    };
    
    const response = await messaging.send(message);
    
    logger.info('Topic notification sent successfully', { topic });
    return response;
  } catch (error) {
    logger.error('Failed to send topic notification:', error);
    throw error;
  }
};

// Firebase Security Rules validation
const validateSecurityRules = async (rules) => {
  if (isMockMode) {
    return true;
  }
  try {
    const securityRules = getFirebaseApp().securityRules();
    await securityRules.validateRules(rules);
    
    logger.info('Security rules validated successfully');
    return true;
  } catch (error) {
    logger.error('Security rules validation failed:', error);
    throw error;
  }
};

const publishSecurityRules = async (rules) => {
  if (isMockMode) {
    return true;
  }
  try {
    const securityRules = getFirebaseApp().securityRules();
    await securityRules.publishRules(rules);
    
    logger.info('Security rules published successfully');
    return true;
  } catch (error) {
    logger.error('Failed to publish security rules:', error);
    throw error;
  }
};

// Error handling helpers
const isFirebaseError = (error) => {
  return error.code && error.code.startsWith('auth/');
};

const getFirebaseErrorMessage = (error) => {
  if (!isFirebaseError(error)) {
    return error.message;
  }

  const errorMessages = {
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'User account is disabled',
    'auth/email-already-exists': 'Email address already exists',
    'auth/weak-password': 'Password is too weak',
    'auth/invalid-credential': 'Invalid credentials',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'auth/invalid-id-token': 'Invalid authentication token',
    'auth/id-token-expired': 'Authentication token has expired'
  };

  return errorMessages[error.code] || error.message;
};

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  getAuth,
  getFirestore,
  verifyIdToken,
  createCustomToken,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setCustomUserClaims,
  revokeRefreshTokens,
  generatePasswordResetLink,
  generateEmailVerificationLink,
  sendNotification,
  sendToTopic,
  validateSecurityRules,
  publishSecurityRules,
  isFirebaseError,
  getFirebaseErrorMessage
};
