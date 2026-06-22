const router = require('express').Router();
const { db } = require('../firebase');
const authenticate = require('../middleware/authenticate');
const { requireBody, requireQuery } = require('../middleware/validate');

const MAX_HISTORY_ENTRIES = 50;

// POST /api/history — log a video watch event
router.post('/', authenticate, requireBody('childId', 'videoId'), async (req, res) => {
  const { childId, videoId, title, channelTitle, thumbnail } = req.body;

  const historyEntry = {
    videoId,
    title: String(title || 'Unknown').slice(0, 200),
    channelTitle: String(channelTitle || 'Unknown').slice(0, 100),
    thumbnail: String(thumbnail || '').slice(0, 500),
    timestamp: new Date().toISOString(),
  };

  try {
    const childRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId);

    const doc = await childRef.get();
    let history = doc.exists && Array.isArray(doc.data().history) ? doc.data().history : [];

    // Prepend newest entry, cap at max
    history = [historyEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);

    await childRef.set({ history }, { merge: true });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[history] log error:', err.message);
    res.status(500).json({ error: 'Failed to log watch history.' });
  }
});

// GET /api/history?childId=xxx — fetch watch history for a child
router.get('/', authenticate, requireQuery('childId'), async (req, res) => {
  const { childId } = req.query;
  try {
    const doc = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .get();

    const history = doc.exists && Array.isArray(doc.data().history) ? doc.data().history : [];
    res.status(200).json(history);
  } catch (err) {
    console.error('[history] fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch watch history.' });
  }
});

module.exports = router;
