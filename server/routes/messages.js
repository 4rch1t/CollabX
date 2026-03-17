const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get conversation list
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const conversations = await Message.aggregate([
      { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender'] },
          lastMessage: { $first: '$content' },
          lastDate: { $first: '$createdAt' },
          unread: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$read', false] }] }, 1, 0]
            }
          }
        }
      },
      { $sort: { lastDate: -1 } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      {
        $project: {
          user: { _id: '$u._id', name: '$u.name', avatar: '$u.avatar' },
          lastMessage: 1, lastDate: 1, unread: 1
        }
      }
    ]);
    res.json(conversations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get messages with a specific user
router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    }).populate('sender', 'name avatar').sort({ createdAt: 1 }).limit(200);

    // Mark received messages as read
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user.id, read: false },
      { read: true }
    );
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get total unread message count
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user.id, read: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
