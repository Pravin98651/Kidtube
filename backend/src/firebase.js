const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));
  }
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin. Ensure FIREBASE_SERVICE_ACCOUNT env var or firebase-service-account.json exists.', error.message);
}

const db = admin.firestore();

module.exports = { admin, db };
