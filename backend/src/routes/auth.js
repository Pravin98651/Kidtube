const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { db } = require('../firebase');
const { requireBody } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET || 'kidtube-super-secret-key-2026';

// POST /api/signup
router.post('/signup', requireBody('email', 'password'), async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    if (doc.exists) return res.status(409).json({ error: 'An account with this email already exists.' });

    await userRef.set({ email: email.toLowerCase(), password });
    const token = jwt.sign(
      { uid: email.toLowerCase(), email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
    res.status(201).json({ token, userId: email.toLowerCase() });
  } catch (err) {
    console.error('[auth] signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// POST /api/login
router.post('/login', requireBody('email', 'password'), async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    if (!doc.exists || doc.data().password !== password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { uid: email.toLowerCase(), email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
    res.status(200).json({ token, userId: email.toLowerCase() });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/device-password  (authenticated)
const authenticate = require('../middleware/authenticate');
router.post('/device-password', authenticate, requireBody('password'), async (req, res) => {
  const { password } = req.body;
  const email = req.user.email;
  try {
    await db.collection('accounts').doc(email).set({ email, password }, { merge: true });
    res.status(200).json({ message: 'Device password updated successfully.' });
  } catch (err) {
    console.error('[auth] device-password error:', err.message);
    res.status(500).json({ error: 'Failed to update device password.' });
  }
});

module.exports = router;
