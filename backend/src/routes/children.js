const router = require('express').Router();
const { db } = require('../firebase');
const authenticate = require('../middleware/authenticate');
const { requireBody } = require('../middleware/validate');

// POST /api/children — create a new child profile
router.post('/', authenticate, requireBody('name'), async (req, res) => {
  const { name, avatar } = req.body;
  try {
    const childRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc();

    const childData = {
      id: childRef.id,
      name: name.trim(),
      avatar: avatar || '',
      stars: 0,
      dailyLimitMins: 60,
      bedtime: '',
      hiddenVideos: [],
      createdAt: new Date().toISOString(),
    };

    await childRef.set(childData);
    res.status(201).json(childData);
  } catch (err) {
    console.error('[children] create error:', err.message);
    res.status(500).json({ error: 'Failed to create child profile.' });
  }
});

// GET /api/children — list all child profiles
router.get('/', authenticate, async (req, res) => {
  try {
    const snapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .orderBy('createdAt', 'asc')
      .get();

    const children = snapshot.docs.map((doc) => doc.data());
    res.status(200).json(children);
  } catch (err) {
    console.error('[children] fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch child profiles.' });
  }
});

// POST /api/children/:childId/settings — update screen time rules
router.post('/:childId/settings', authenticate, async (req, res) => {
  const { childId } = req.params;
  const { dailyLimitMins, bedtime } = req.body;

  const update = {};
  if (dailyLimitMins !== undefined) update.dailyLimitMins = Number(dailyLimitMins);
  if (bedtime !== undefined) update.bedtime = bedtime;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  try {
    await db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId)
      .set(update, { merge: true });

    res.status(200).json({ success: true, updated: update });
  } catch (err) {
    console.error('[children] settings error:', err.message);
    res.status(500).json({ error: 'Failed to update child settings.' });
  }
});
// DELETE /api/children/:childId — remove a child profile and its subscriptions
router.delete('/:childId', authenticate, async (req, res) => {
  const { childId } = req.params;
  try {
    const childRef = db
      .collection('users')
      .doc(req.user.uid)
      .collection('children')
      .doc(childId);

    // Optional: Delete subcollections like subscriptions (Firestore doesn't auto-delete subcollections)
    const subsSnapshot = await childRef.collection('subscriptions').get();
    const batch = db.batch();
    subsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the child document itself
    batch.delete(childRef);
    await batch.commit();

    res.status(200).json({ success: true, message: 'Child profile deleted.' });
  } catch (err) {
    console.error('[children] delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete child profile.' });
  }
});

module.exports = router;
