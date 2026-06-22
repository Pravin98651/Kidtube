const router = require('express').Router();
const { db } = require('../firebase');
const youtube = require('../youtube');
const authenticate = require('../middleware/authenticate');
const { requireBody, requireQuery } = require('../middleware/validate');

// POST /api/channels — approve one or more channels for a child
router.post('/', authenticate, requireBody('query', 'childId'), async (req, res) => {
  const { query, childId } = req.body;
  const userId = req.user.uid;

  const queries = query
    .split(',')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  let totalProcessed = 0;
  let totalApproved = 0;
  const addedChannels = [];
  const errors = [];

  try {
    for (const q of queries) {
      try {
        const channelId = await youtube.resolveChannelId(q);
        if (!channelId) {
          errors.push(`Channel not found: "${q}"`);
          continue;
        }

        const globalChannelRef = db.collection('channels').doc(channelId);
        const [globalChannelDoc, existingVideosSnap] = await Promise.all([
          globalChannelRef.get(),
          db.collection('videos').where('channelId', '==', channelId).limit(1).get(),
        ]);

        const needsIndexing = !globalChannelDoc.exists || existingVideosSnap.empty;
        let channelTitle = globalChannelDoc.exists
          ? globalChannelDoc.data().channelTitle
          : q;

        if (needsIndexing) {
          const videoIds = await youtube.fetchChannelVideos(channelId, 20);
          const approvedVideos = await youtube.filterAndGetVideos(videoIds, false, [], []);
          totalProcessed += videoIds.length;
          totalApproved += approvedVideos.length;

          if (approvedVideos.length > 0) channelTitle = approvedVideos[0].channelTitle;

          await globalChannelRef.set(
            { channelId, channelTitle, addedAt: new Date().toISOString() },
            { merge: true }
          );

          const batch = db.batch();
          for (const video of approvedVideos) {
            batch.set(db.collection('videos').doc(video.videoId), video);
          }
          await batch.commit();
        }

        // Link channel to the specific child's subscription list
        await db
          .collection('users')
          .doc(userId)
          .collection('children')
          .doc(childId)
          .collection('subscriptions')
          .doc(channelId)
          .set({ channelId, channelTitle, addedAt: new Date().toISOString() });

        addedChannels.push(channelTitle);
      } catch (err) {
        console.error(`[channels] error processing "${q}":`, err.message);
        errors.push(`Failed to process: "${q}"`);
      }
    }

    res.status(200).json({
      message: `Successfully added ${addedChannels.length} channel(s).`,
      addedChannels,
      videosProcessed: totalProcessed,
      videosApproved: totalApproved,
      ...(errors.length > 0 && { errors }),
    });
  } catch (err) {
    console.error('[channels] batch error:', err.message);
    res.status(500).json({ error: 'Internal server error while adding channels.' });
  }
});

// GET /api/channels?childId=xxx — list approved channels for a child
router.get('/', authenticate, requireQuery('childId'), async (req, res) => {
  const { childId } = req.query;
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .collection('subscriptions')
      .orderBy('addedAt', 'desc')
      .get();

    res.status(200).json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    console.error('[channels] fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch approved channels.' });
  }
});

// DELETE /api/channels/:id?childId=xxx — remove a channel for a child
router.delete('/:id', authenticate, requireQuery('childId'), async (req, res) => {
  const { childId } = req.query;
  const { id } = req.params;
  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .collection('subscriptions')
      .doc(id)
      .delete();

    res.status(200).json({ message: 'Channel removed successfully.' });
  } catch (err) {
    console.error('[channels] delete error:', err.message);
    res.status(500).json({ error: 'Failed to remove channel.' });
  }
});

module.exports = router;
