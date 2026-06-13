require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'KidTube API' });
});

const { db, admin } = require('./src/firebase');
const youtube = require('./src/youtube');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kidtube-super-secret-key-2026';

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedFirebase = await admin.auth().verifyIdToken(token);
    req.user = { uid: decodedFirebase.email.toLowerCase(), email: decodedFirebase.email.toLowerCase() };
    return next();
  } catch (firebaseError) {
    try {
      const decodedJwt = jwt.verify(token, JWT_SECRET);
      req.user = decodedJwt;
      return next();
    } catch (jwtError) {
      console.error('Auth error:', firebaseError.message, jwtError.message);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }
};

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    if (doc.exists) return res.status(400).json({ error: 'Email already exists' });
    await userRef.set({ email: email.toLowerCase(), password });
    const token = jwt.sign({ uid: email.toLowerCase(), email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '365d' });
    res.status(200).json({ token, userId: email.toLowerCase() });
  } catch (err) { res.status(500).json({ error: 'Signup failed' }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    if (!doc.exists || doc.data().password !== password) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ uid: email.toLowerCase(), email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '365d' });
    res.status(200).json({ token, userId: email.toLowerCase() });
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

app.post('/api/device-password', authenticate, async (req, res) => {
  const { password } = req.body;
  const email = req.user.email;
  if (!password) return res.status(400).json({ error: 'Missing password' });
  try {
    await db.collection('accounts').doc(email).set({ email, password }, { merge: true });
    res.status(200).json({ message: 'Device password set successfully' });
  } catch (err) { res.status(500).json({ error: 'Failed to set password' }); }
});

// --- NEW CHILDREN ENDPOINTS ---

app.post('/api/children', authenticate, async (req, res) => {
  const { name, avatar } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    const childRef = db.collection('users').doc(req.user.uid).collection('children').doc();
    const childData = {
      id: childRef.id,
      name,
      avatar: avatar || '',
      stars: 0,
      dailyLimitMins: 60,
      bedtime: '',
      hiddenVideos: [],
      createdAt: new Date().toISOString()
    };
    await childRef.set(childData);
    res.status(200).json(childData);
  } catch (error) { res.status(500).json({ error: 'Failed to create child' }); }
});

app.get('/api/children', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('users').doc(req.user.uid).collection('children').get();
    const children = snapshot.docs.map(doc => doc.data());
    res.status(200).json(children);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch children' }); }
});

app.post('/api/children/:childId/settings', authenticate, async (req, res) => {
  const { dailyLimitMins, bedtime } = req.body;
  try {
    await db.collection('users').doc(req.user.uid).collection('children').doc(req.params.childId).set({
      dailyLimitMins,
      bedtime
    }, { merge: true });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to update settings' }); }
});

// --- END CHILDREN ENDPOINTS ---

app.post('/api/channels', authenticate, async (req, res) => {
  const { query, childId } = req.body;
  const userId = req.user.uid;
  if (!query || !childId) return res.status(400).json({ error: 'Missing channel query or childId' });

  const queries = query.split(',').map(q => q.trim()).filter(q => q.length > 0);
  let totalProcessed = 0, totalApproved = 0, addedChannels = [], errors = [];

  try {
    for (const q of queries) {
      try {
        const channelId = await youtube.resolveChannelId(q);
        if (!channelId) { errors.push(`Not found: ${q}`); continue; }

        const globalChannelRef = db.collection('channels').doc(channelId);
        const globalChannelDoc = await globalChannelRef.get();
        const existingVideos = await db.collection('videos').where('channelId', '==', channelId).limit(1).get();
        const needsIndexing = !globalChannelDoc.exists || existingVideos.empty;
        let channelTitle = globalChannelDoc.exists ? globalChannelDoc.data().channelTitle : q;

        if (needsIndexing) {
          const videoIds = await youtube.fetchChannelVideos(channelId, 20);
          const approvedVideos = await youtube.filterAndGetVideos(videoIds, false, [], []);
          totalProcessed += videoIds.length; totalApproved += approvedVideos.length;
          if (approvedVideos.length > 0) channelTitle = approvedVideos[0].channelTitle;

          await globalChannelRef.set({ channelId, channelTitle, addedAt: new Date().toISOString() }, { merge: true });
          const batch = db.batch();
          for (const video of approvedVideos) {
            batch.set(db.collection('videos').doc(video.videoId), video);
          }
          await batch.commit();
        }

        // Link channel to Specific Child's Subscriptions
        await db.collection('users').doc(userId).collection('children').doc(childId).collection('subscriptions').doc(channelId).set({
          channelId, channelTitle, addedAt: new Date().toISOString()
        });
        addedChannels.push(channelTitle);
      } catch (err) { errors.push(`Failed: ${q}`); }
    }
    res.status(200).json({ message: `Successfully added ${addedChannels.length} channels.`, addedChannels, videosProcessed: totalProcessed, videosApproved: totalApproved, errors: errors.length > 0 ? errors : undefined });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/channels', authenticate, async (req, res) => {
  const { childId } = req.query;
  if (!childId) return res.status(400).json({ error: 'Missing childId' });
  try {
    const subsSnapshot = await db.collection('users').doc(req.user.uid).collection('children').doc(childId).collection('subscriptions').get();
    res.status(200).json(subsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) { res.status(500).json({ error: 'Failed to fetch channels' }); }
});

app.delete('/api/channels/:id', authenticate, async (req, res) => {
  const { childId } = req.query;
  if (!childId) return res.status(400).json({ error: 'Missing childId' });
  try {
    await db.collection('users').doc(req.user.uid).collection('children').doc(childId).collection('subscriptions').doc(req.params.id).delete();
    res.status(200).json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete' }); }
});

app.get('/api/videos', authenticate, async (req, res) => {
  const { childId, includeHidden } = req.query;
  if (!childId) return res.status(400).json({ error: 'Missing childId' });
  try {
    const childDoc = await db.collection('users').doc(req.user.uid).collection('children').doc(childId).get();
    if (!childDoc.exists) return res.status(404).json({ error: 'Child not found' });
    const hiddenVideos = childDoc.data().hiddenVideos || [];

    const subsSnapshot = await db.collection('users').doc(req.user.uid).collection('children').doc(childId).collection('subscriptions').get();
    const subscribedIds = subsSnapshot.docs.map(doc => doc.id);
    if (subscribedIds.length === 0) return res.status(200).json([]);
    
    const promises = subscribedIds.map(channelId => db.collection('videos').where('channelId', '==', channelId).limit(50).get());
    const results = await Promise.all(promises);
    let videos = [];
    results.forEach(snapshot => {
      snapshot.forEach(doc => {
        const isHidden = hiddenVideos.includes(doc.id);
        if (includeHidden === 'true' || !isHidden) {
          videos.push({ id: doc.id, isHidden, ...doc.data() });
        }
      });
    });
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.status(200).json(videos);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch videos' }); }
});

// --- GRANULAR BLOCKING ENDPOINTS ---
app.post('/api/videos/hide', authenticate, async (req, res) => {
  const { childId, videoId } = req.body;
  if (!childId || !videoId) return res.status(400).json({ error: 'Missing childId or videoId' });
  try {
    await db.collection('users').doc(req.user.uid).collection('children').doc(childId).update({
      hiddenVideos: admin.firestore.FieldValue.arrayUnion(videoId)
    });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/videos/unhide', authenticate, async (req, res) => {
  const { childId, videoId } = req.body;
  try {
    await db.collection('users').doc(req.user.uid).collection('children').doc(childId).update({
      hiddenVideos: admin.firestore.FieldValue.arrayRemove(videoId)
    });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// --- GAMIFICATION ENDPOINT ---
app.post('/api/stars', authenticate, async (req, res) => {
  const { childId, starsToAdd } = req.body;
  try {
    await db.collection('users').doc(req.user.uid).collection('children').doc(childId).update({
      stars: admin.firestore.FieldValue.increment(starsToAdd || 10)
    });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to add stars' }); }
});

app.post('/api/history', authenticate, async (req, res) => {
  const { childId, videoId, title, channelTitle, thumbnail } = req.body;
  if (!childId || !videoId) return res.status(400).json({ error: 'Missing data' });
  try {
    const historyEntry = { videoId, title: title || 'Unknown', channelTitle: channelTitle || 'Unknown', thumbnail: thumbnail || '', timestamp: new Date().toISOString() };
    const childRef = db.collection('users').doc(req.user.uid).collection('children').doc(childId);
    const doc = await childRef.get();
    let history = doc.exists && doc.data().history ? doc.data().history : [];
    history.unshift(historyEntry);
    if (history.length > 50) history = history.slice(0, 50);
    await childRef.set({ history }, { merge: true });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/history', authenticate, async (req, res) => {
  const { childId } = req.query;
  try {
    const doc = await db.collection('users').doc(req.user.uid).collection('children').doc(childId).get();
    res.status(200).json(doc.exists ? (doc.data().history || []) : []);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).collection('settings').doc('global').get();
    res.status(200).json(doc.exists ? doc.data() : { disableShorts: true, educationalTollbooth: false });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/settings', authenticate, async (req, res) => {
  try {
    await db.collection('users').doc(req.user.uid).collection('settings').doc('global').set(req.body, { merge: true });
    res.status(200).json({ message: 'Settings updated' });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

const SYNC_SECRET = process.env.SYNC_SECRET || 'fallback-sync-secret';

app.post('/api/sync', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${SYNC_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized sync' });
  }

  let totalProcessed = 0;
  let totalAdded = 0;
  let errors = [];

  try {
    const channelsSnapshot = await db.collection('channels').get();
    if (channelsSnapshot.empty) {
      return res.status(200).json({ message: 'No channels to sync.' });
    }

    let disableShorts = true;
    try {
      // NOTE: We don't have a specific user here, so we apply a global default if we can't find a user setting.
      // Usually disableShorts is true by default.
    } catch(e) {}

    for (const doc of channelsSnapshot.docs) {
      const channelId = doc.id;
      try {
        const videoIds = await youtube.fetchChannelVideos(channelId, 5); 
        
        const newVideoIds = [];
        for (const vid of videoIds) {
          const videoDoc = await db.collection('videos').doc(vid).get();
          if (!videoDoc.exists) newVideoIds.push(vid);
        }

        if (newVideoIds.length > 0) {
          const approvedVideos = await youtube.filterAndGetVideos(newVideoIds, disableShorts, [], []);
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
        errors.push(`Failed to sync channel ${channelId}: ${err.message}`);
      }
    }

    res.status(200).json({ 
      message: 'Sync completed', 
      processed: totalProcessed, 
      added: totalAdded, 
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Internal server error during sync' });
  }
});

app.listen(PORT, () => {
  console.log(`KidTube Backend API listening on port ${PORT}`);
  const PING_URL = process.env.PING_URL || 'https://kidtube-almy.onrender.com/health';
  setInterval(() => {
    fetch(PING_URL).then(res => { if (res.ok) console.log(`[KeepAlive] Pinged`); }).catch(err => {});
  }, 14 * 60 * 1000);
});
