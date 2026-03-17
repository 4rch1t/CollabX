const mongoose = require('mongoose');
const crypto = require('crypto');

const projectSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  description:    { type: String, required: true },
  owner:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:       { type: String, enum: ['hackathon', 'project', 'startup', 'research'], default: 'project' },
  requiredSkills: [{ type: String, trim: true }],
  teamSize:       { type: Number, default: 4 },
  members:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  leader:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inviteCode:     { type: String, unique: true, sparse: true },
  status:         { type: String, enum: ['open', 'in-progress', 'completed'], default: 'open' },
  createdAt:      { type: Date, default: Date.now }
});

projectSchema.pre('save', function (next) {
  if (!this.leader) this.leader = this.owner;
  if (!this.inviteCode) this.inviteCode = crypto.randomBytes(4).toString('hex');
  next();
});

module.exports = mongoose.model('Project', projectSchema);
