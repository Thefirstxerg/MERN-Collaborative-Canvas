const mongoose = require('mongoose');

const canvasChunkSchema = new mongoose.Schema({
  chunkX: {
    type: Number,
    required: true,
    min: 0,
    max: 2
  },
  chunkY: {
    type: Number,
    required: true,
    min: 0,
    max: 2
  },
  pixels: {
    type: [Number],
    required: true,
    validate: {
      validator: function(array) {
        return array.length === 2500; // 50x50 pixels
      },
      message: 'Pixels array must contain exactly 2500 elements'
    }
  }
}, {
  timestamps: true
});

// Create compound index for efficient chunk lookups
canvasChunkSchema.index({ chunkX: 1, chunkY: 1 }, { unique: true });

module.exports = mongoose.model('CanvasChunk', canvasChunkSchema);