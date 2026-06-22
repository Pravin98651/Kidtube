const jwt = require('jsonwebtoken');
const { admin } = require('../firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'kidtube-super-secret-key-2026';

/**
 * Authentication middleware.
 * Accepts both Firebase ID tokens (from the parent web dashboard)
 * and custom JWTs (issued to child devices via /api/login).
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Strategy 1: Try Firebase ID Token (parent dashboard)
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.email.toLowerCase(),
      email: decoded.email.toLowerCase(),
    };
    return next();
  } catch (_firebaseErr) {
    // Not a Firebase token — fall through to JWT strategy
  }

  // Strategy 2: Try custom JWT (child device)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_jwtErr) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = authenticate;
