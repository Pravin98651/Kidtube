const router = require('express').Router();
const { db } = require('../firebase');
const youtube = require('../youtube');

const SYNC_SECRET = process.env.SYNC_SECRET || 'fallback-sync-secret';
const MAX_VIDEOS_PER_CHANNEL = 5; // Keep low to respect Render's 100s HTTP timeout

/**
 * POST /api/sync
 * Secured with a separate SYNC_SECRET (not user auth).
 * Called by the GitHub Actions nightly cron job to keep video feeds fresh.
 */
router.post('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${SYNC_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid sync secret.' });
  }

  let totalProcessed = 0;
  let totalAdded = 0;
  const errors = [];

  try {
    const channelsSnapshot = await db.collection('channels').get();

    if (channelsSnapshot.empty) {
      return res.status(200).json({ message: 'No channels to sync. Database is empty.' });
    }

    for (const doc of channelsSnapshot.docs) {
      const channelId = doc.id;
      try {
        const videoIds = await youtube.fetchChannelVideos(channelId, MAX_VIDEOS_PER_CHANNEL);

        // Only process videos we haven't seen before
        const newVideoIds = [];
        for (const vid of videoIds) {
          const videoDoc = await db.collection('videos').doc(vid).get();
          if (!videoDoc.exists) newVideoIds.push(vid);
        }

        if (newVideoIds.length > 0) {
          const approvedVideos = await youtube.filterAndGetVideos(newVideoIds, true, [], []);
          totalProcessed += newVideoIds.length;
          totalAdded += approvedVideos.length;

          if (approvedVideos.length > 0) {
            const batch = db.batch();
            for (const video of approvedVideos) {
              batch.set(db.collection('videos').doc(video.videoId), video, { merge: true });
            }
            await batch.commit();
          }
        }
      } catch (err) {
        console.error(`[sync] error on channel ${channelId}:`, err.message);
        errors.push(`Channel ${channelId}: ${err.message}`);
      }
    }

    const response = {
      message: 'Nightly sync completed.',
      channelsChecked: channelsSnapshot.size,
      newVideosProcessed: totalProcessed,
      newVideosAdded: totalAdded,
    };
    if (errors.length > 0) response.errors = errors;

    res.status(200).json(response);
  } catch (err) {
    console.error('[sync] fatal error:', err.message);
    res.status(500).json({ error: 'Sync failed due to an internal server error.' });
  }
});

module.exports = router;
