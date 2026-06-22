const router = require('express').Router();
const { db, admin } = require('../firebase');
const authenticate = require('../middleware/authenticate');
const { requireBody, requireQuery } = require('../middleware/validate');

// GET /api/videos?childId=xxx — fetch videos for a child's feed
router.get('/', authenticate, requireQuery('childId'), async (req, res) => {
  const { childId, includeHidden } = req.query;

  try {
    const childRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId);

    const [childDoc, subsSnapshot] = await Promise.all([
      childRef.get(),
      childRef.collection('subscriptions').get(),
    ]);

    if (!childDoc.exists) return res.status(404).json({ error: 'Child profile not found.' });

    const hiddenVideos = childDoc.data().hiddenVideos || [];
    const subscribedChannelIds = subsSnapshot.docs.map((doc) => doc.id);

    if (subscribedChannelIds.length === 0) return res.status(200).json([]);

    // Fetch videos for all subscribed channels in parallel
    const videoSnapshots = await Promise.all(
      subscribedChannelIds.map((channelId) =>
        db.collection('videos').where('channelId', '==', channelId).limit(50).get()
      )
    );

    const videos = [];
    for (const snapshot of videoSnapshots) {
      for (const doc of snapshot.docs) {
        const isHidden = hiddenVideos.includes(doc.id);
        if (includeHidden === 'true' || !isHidden) {
          videos.push({ id: doc.id, isHidden, ...doc.data() });
        }
      }
    }

    // Sort by newest first
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.status(200).json(videos);
  } catch (err) {
    console.error('[videos] fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch videos.' });
  }
});

// POST /api/videos/hide — hide a video for a child
router.post('/hide', authenticate, requireBody('childId', 'videoId'), async (req, res) => {
  const { childId, videoId } = req.body;
  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .update({ hiddenVideos: admin.firestore.FieldValue.arrayUnion(videoId) });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[videos] hide error:', err.message);
    res.status(500).json({ error: 'Failed to hide video.' });
  }
});

// POST /api/videos/unhide — restore a hidden video for a child
router.post('/unhide', authenticate, requireBody('childId', 'videoId'), async (req, res) => {
  const { childId, videoId } = req.body;
  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .update({ hiddenVideos: admin.firestore.FieldValue.arrayRemove(videoId) });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[videos] unhide error:', err.message);
    res.status(500).json({ error: 'Failed to unhide video.' });
  }
});

// POST /api/stars — award stars to a child (gamification)
router.post('/stars', authenticate, requireBody('childId'), async (req, res) => {
  const { childId, starsToAdd } = req.body;
  const amount = parseInt(starsToAdd) || 10;
  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .update({ stars: admin.firestore.FieldValue.increment(amount) });

    res.status(200).json({ success: true, starsAdded: amount });
  } catch (err) {
    console.error('[videos] stars error:', err.message);
    res.status(500).json({ error: 'Failed to award stars.' });
  }
});

module.exports = router;
