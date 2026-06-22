const router = require('express').Router();
const { db } = require('../firebase');
const authenticate = require('../middleware/authenticate');

const DEFAULT_SETTINGS = {
  disableShorts: true,
  educationalTollbooth: false,
};

// GET /api/settings — fetch global settings for the authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const doc = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('settings')
      .doc('global')
      .get();

    res.status(200).json(doc.exists ? { ...DEFAULT_SETTINGS, ...doc.data() } : DEFAULT_SETTINGS);
  } catch (err) {
    console.error('[settings] fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// POST /api/settings — update global settings
router.post('/', authenticate, async (req, res) => {
  // Only allow known fields to be saved
  const { disableShorts, educationalTollbooth } = req.body;
  const update = {};
  if (disableShorts !== undefined) update.disableShorts = Boolean(disableShorts);
  if (educationalTollbooth !== undefined) update.educationalTollbooth = Boolean(educationalTollbooth);

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No valid settings fields provided.' });
  }

  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('settings')
      .doc('global')
      .set(update, { merge: true });

    res.status(200).json({ message: 'Settings updated.', settings: update });
  } catch (err) {
    console.error('[settings] update error:', err.message);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;
