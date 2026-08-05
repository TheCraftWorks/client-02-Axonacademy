const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate a token for a user to join a specific LiveKit room
router.get('/get-token', protect, async (req, res) => {
  const { room } = req.query;
  const participantName = req.user.fullName || req.user.email;

  if (!room) {
    return res.status(400).json({ error: 'room is required' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });
    
    // Set permissions: allow user to join the room, publish/subscribe tracks.
    at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    res.json({ token });
  } catch (err) {
    console.error('Error generating LiveKit token:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
