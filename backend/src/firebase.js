const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

try {
  const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin. Ensure firebase-service-account.json exists in the backend root directory.', error.message);
}

const db = admin.firestore();

module.exports = { admin, db };
