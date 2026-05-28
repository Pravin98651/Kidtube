require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin (requires service account key in environment variable or file)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault()
// });

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'KidTube API' });
});

// Import Firebase and YouTube modules
const { db, admin } = require('./src/firebase');
const youtube = require('./src/youtube');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kidtube-super-secret-key-2026';

// Auth Middleware (Firebase + JWT Fallback)
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  
  try {
    // 1. Try Firebase Auth (used by Dashboard)
    const decodedFirebase = await admin.auth().verifyIdToken(token);
    req.user = { uid: decodedFirebase.email.toLowerCase(), email: decodedFirebase.email.toLowerCase() };
    return next();
  } catch (firebaseError) {
    // 2. Fallback to custom JWT (used by Child App)
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

// Endpoint: Parent Signup (Used by Child App or API testing)
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    if (doc.exists) return res.status(400).json({ error: 'Email already exists' });
    
    // In a production app, use bcrypt to hash the password. Storing raw for prototype simplicity.
    await userRef.set({ email: email.toLowerCase(), password });
    
    const token = jwt.sign({ uid: email.toLowerCase(), email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '365d' });
    res.status(200).json({ token, userId: email.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Endpoint: Parent Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRef = db.collection('accounts').doc(email.toLowerCase());
    const doc = await userRef.get();
    
    if (!doc.exists || doc.data().password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ uid: email.toLowerCase(), email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '365d' });
    res.status(200).json({ token, userId: email.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Endpoint: Set Device Password (Used by Dashboard to create a password for the child app)
app.post('/api/device-password', authenticate, async (req, res) => {
  const { password } = req.body;
  const email = req.user.email;
  
  if (!password) return res.status(400).json({ error: 'Missing password' });

  try {
    const userRef = db.collection('accounts').doc(email);
    await userRef.set({ email, password }, { merge: true });
    res.status(200).json({ message: 'Device password set successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// Removed manual Google Auth endpoint because Firebase handles it now on the client.

// Endpoint: Add new channels to whitelist (supports comma separated list)
app.post('/api/channels', authenticate, async (req, res) => {
  const { query } = req.body;
  const userId = req.user.uid;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing channel query' });
  }

  const queries = query.split(',').map(q => q.trim()).filter(q => q.length > 0);
  let totalProcessed = 0;
  let totalApproved = 0;
  let addedChannels = [];
  let errors = [];

  try {
    for (const q of queries) {
      try {
        // 1. Resolve Channel ID
        const channelId = await youtube.resolveChannelId(q);
        if (!channelId) {
          errors.push(`Could not find channel for: ${q}`);
          continue;
        }

        // 2. Check if channel already exists in global pool
        const globalChannelRef = db.collection('channels').doc(channelId);
        const globalChannelDoc = await globalChannelRef.get();
        
        // Self-healing: Check if videos actually exist
        const existingVideos = await db.collection('videos').where('channelId', '==', channelId).limit(1).get();
        const needsIndexing = !globalChannelDoc.exists || existingVideos.empty;
        
        let channelTitle = globalChannelDoc.exists ? globalChannelDoc.data().channelTitle : q;

        if (needsIndexing) {
          // Fetch Recent Videos from Channel
          const videoIds = await youtube.fetchChannelVideos(channelId, 50);

          const approvedVideos = await youtube.filterAndGetVideos(videoIds, false, [], []);
          
          totalProcessed += videoIds.length;
          totalApproved += approvedVideos.length;
          
          if (approvedVideos.length > 0) {
            channelTitle = approvedVideos[0].channelTitle;
          }

          // Save to Global Firestore Pool
          await globalChannelRef.set({
            channelId,
            channelTitle,
            addedAt: new Date().toISOString()
          }, { merge: true });

          const batch = db.batch();
          for (const video of approvedVideos) {
            const videoRef = db.collection('videos').doc(video.videoId);
            batch.set(videoRef, video);
          }
          await batch.commit();
        } else {
           console.log(`Channel ${q} already indexed.`);
        }

        // 3. Link channel to User's Subscriptions
        const userSubRef = db.collection('users').doc(userId).collection('subscriptions').doc(channelId);
        await userSubRef.set({
          channelId,
          channelTitle,
          addedAt: new Date().toISOString()
        });

        addedChannels.push(channelTitle);
      } catch (err) {
        console.error(`Error processing channel ${q}:`, err);
        errors.push(`Failed to process: ${q}`);
      }
    }

    res.status(200).json({
      message: `Successfully added ${addedChannels.length} channels.`,
      addedChannels,
      videosProcessed: totalProcessed,
      videosApproved: totalApproved,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error adding channels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint: Get all approved channels
app.get('/api/channels', authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const subsSnapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
    
    const channels = subsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Endpoint: Get all approved videos
app.get('/api/videos', authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const subsSnapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
    const subscribedIds = subsSnapshot.docs.map(doc => doc.id);
    
    if (subscribedIds.length === 0) return res.status(200).json([]);
    
    const promises = subscribedIds.map(channelId => 
      db.collection('videos')
        .where('channelId', '==', channelId)
        .limit(50)
        .get()
    );
    
    const results = await Promise.all(promises);
    let videos = [];
    results.forEach(snapshot => {
      snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
    });
    
    // Sort combined feed by publishedAt desc
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    
    res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Endpoint: Delete a channel
app.delete('/api/channels/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    await db.collection('users').doc(userId).collection('subscriptions').doc(req.params.id).delete();
    res.status(200).json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Endpoint: Log Watch History
app.post('/api/history', authenticate, async (req, res) => {
  const { videoId, title, channelTitle, thumbnail } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  try {
    const historyEntry = {
      videoId,
      title: title || 'Unknown Video',
      channelTitle: channelTitle || 'Unknown Channel',
      thumbnail: thumbnail || '',
      timestamp: new Date().toISOString()
    };
    
    const userRef = db.collection('users').doc(req.user.uid).collection('settings').doc('history');
    const doc = await userRef.get();
    let history = doc.exists && doc.data().videos ? doc.data().videos : [];
    
    // Add to beginning of array and slice to keep only latest 50
    history.unshift(historyEntry);
    if (history.length > 50) history = history.slice(0, 50);

    await userRef.set({ videos: history }, { merge: true });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging history:', error);
    res.status(500).json({ error: 'Failed to log history' });
  }
});

// Endpoint: Get Watch History
app.get('/api/history', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).collection('settings').doc('history').get();
    res.status(200).json(doc.exists ? (doc.data().videos || []) : []);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Endpoint: Get settings
app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const doc = await db.collection('users').doc(userId).collection('settings').doc('global').get();
    res.status(200).json(doc.exists ? doc.data() : { disableShorts: true });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Endpoint: Update settings
app.post('/api/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    await db.collection('users').doc(userId).collection('settings').doc('global').set(req.body, { merge: true });
    res.status(200).json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Endpoint: Nightly Sync Job (called by GitHub Actions)
app.post('/api/sync', async (req, res) => {
  // In a real scenario, protect this with a secret token
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized sync request' });
  }

  try {
    // Fetch global or child-specific blocked categories and keywords
    const settingsDoc = await db.collection('settings').doc('global').get();
    const disableShorts = settingsDoc.exists && settingsDoc.data().disableShorts !== undefined ? settingsDoc.data().disableShorts : true;
    const blockedCategoryIds = settingsDoc.exists ? settingsDoc.data().blockedCategoryIds || [] : [];
    const blockedKeywords = settingsDoc.exists ? settingsDoc.data().blockedKeywords || [] : [];

    const channelsSnapshot = await db.collection('channels').get();
    let totalVideosApproved = 0;

    for (const doc of channelsSnapshot.docs) {
      const channelId = doc.id;
      // Fetch latest videos for the channel
      const videoIds = await youtube.fetchChannelVideos(channelId, 50);
      const approvedVideos = await youtube.filterAndGetVideos(videoIds, disableShorts, blockedCategoryIds, blockedKeywords);

      // Save to Firestore
      const batch = db.batch();
      for (const video of approvedVideos) {
        const videoRef = db.collection('videos').doc(video.videoId);
        batch.set(videoRef, video);
      }
      await batch.commit();
      totalVideosApproved += approvedVideos.length;
    }

    res.status(200).json({
      message: 'Sync completed successfully',
      channelsSynced: channelsSnapshot.size,
      totalVideosApproved
    });
  } catch (error) {
    console.error('Error during nightly sync:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Endpoint: 'Ask Parent' flow (Child requests a channel)
app.post('/api/requests', async (req, res) => {
  const { childId, parentToken, channelQuery } = req.body;
  
  if (!childId || !channelQuery) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create a request record in Firestore
    const requestRef = db.collection('requests').doc();
    await requestRef.set({
      childId,
      channelQuery,
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    // 2. Send FCM Push Notification to Parent
    if (parentToken) {
      await admin.messaging().send({
        token: parentToken,
        notification: {
          title: 'KidTube: New Channel Request',
          body: `Your child wants to watch ${channelQuery}. Approve or deny in the dashboard.`
        },
        data: {
          requestId: requestRef.id,
          type: 'channel_request'
        }
      });
    }

    res.status(200).json({ message: 'Request sent successfully', requestId: requestRef.id });
  } catch (error) {
    console.error('Error sending request:', error);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Endpoint: Screen time tracking
app.post('/api/watch-session', async (req, res) => {
  const { childId, durationWatchedSeconds } = req.body;

  try {
    const childRef = db.collection('children').doc(childId);
    
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(childRef);
      if (!doc.exists) {
        throw new Error('Child not found');
      }

      const data = doc.data();
      const newTimeWatched = (data.timeWatchedToday || 0) + durationWatchedSeconds;
      const dailyLimit = data.dailyLimitSeconds || 3600; // 1 hour default

      transaction.update(childRef, {
        timeWatchedToday: newTimeWatched,
        lastWatchedAt: new Date().toISOString()
      });

      // Pass lock status to client
      if (newTimeWatched >= dailyLimit) {
        transaction.update(childRef, { isLocked: true });
      }
    });

    const updatedDoc = await childRef.get();
    res.status(200).json({ 
      timeWatchedToday: updatedDoc.data().timeWatchedToday,
      isLocked: updatedDoc.data().isLocked || false
    });
  } catch (error) {
    console.error('Error tracking screen time:', error);
    res.status(500).json({ error: 'Failed to track watch session' });
  }
});

// Endpoint: Stripe Checkout (Monetization Prep)
app.post('/api/checkout', async (req, res) => {
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // This is a stub for the Stripe checkout session
  res.status(200).json({
    message: 'Stripe integration ready for Phase 3',
    checkoutUrl: 'https://checkout.stripe.com/pay/mock-session'
  });
});

// Endpoint: COPPA Data Deletion
app.delete('/api/account', async (req, res) => {
  const { parentId } = req.body;
  if (!parentId) return res.status(400).json({ error: 'Missing parentId' });

  try {
    // In a real app, verify the authentication token matches the parentId
    // Delete the parent record
    await db.collection('parents').doc(parentId).delete();
    
    // Wipe all children associated with this parent
    const childrenSnapshot = await db.collection('children').where('parentId', '==', parentId).get();
    const batch = db.batch();
    childrenSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.status(200).json({ message: 'Account and all associated child data permanently deleted.' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account data' });
  }
});

app.listen(PORT, () => {
  console.log(`KidTube Backend API listening on port ${PORT}`);
  
  // Internal Cron Job to prevent Render free tier spin-down
  // Pings its own /health endpoint every 14 minutes (840000 ms)
  const PING_URL = process.env.PING_URL || 'https://kidtube-almy.onrender.com/health';
  setInterval(() => {
    // Get current hour in IST (Asia/Kolkata)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hourCycle: 'h23'
    });
    const currentHourIST = parseInt(formatter.format(new Date()), 10);

    // Skip pinging from 1 AM to 3:59 AM to save free tier hours
    if (currentHourIST >= 1 && currentHourIST < 4) {
      console.log(`[KeepAlive] Sleeping. Current hour is ${currentHourIST} AM.`);
      return;
    }

    fetch(PING_URL)
      .then(res => {
        if (res.ok) console.log(`[KeepAlive] Successfully pinged ${PING_URL}`);
        else console.log(`[KeepAlive] Ping failed with status: ${res.status}`);
      })
      .catch(err => console.error(`[KeepAlive] Error pinging ${PING_URL}:`, err.message));
  }, 14 * 60 * 1000);
});
