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

    let targetChannelIds = subscribedChannelIds;
    // If a specific channelId is requested, ensure the child is subscribed to it
    if (req.query.channelId) {
      if (subscribedChannelIds.includes(req.query.channelId)) {
        targetChannelIds = [req.query.channelId];
      } else {
        return res.status(403).json({ error: 'Child is not subscribed to this channel.' });
      }
    }

    if (targetChannelIds.length === 0) return res.status(200).json([]);

    // Fetch all videos for target channels
    const videoSnapshots = await Promise.all(
      targetChannelIds.map((cid) =>
        db.collection('videos').where('channelId', '==', cid).get()
      )
    );

    const videos = [];
    for (const snapshot of videoSnapshots) {
      // Sort the channel's videos by newest first, and take the top 50
      const channelVideos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      channelVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const latest50 = channelVideos.slice(0, 50);

      for (const video of latest50) {
        const isHidden = hiddenVideos.includes(video.id);
        if (includeHidden === 'true' || !isHidden) {
          videos.push({ ...video, isHidden });
        }
      }
    }

    // Finally, sort all the combined videos across all channels by newest first
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
