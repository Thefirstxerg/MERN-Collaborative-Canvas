const CanvasChunk = require('../models/CanvasChunk');

// Initialize canvas chunks if they don't exist
const initializeCanvas = async () => {
  try {
    const existingChunks = await CanvasChunk.countDocuments();
    
    if (existingChunks === 0) {
      console.log('Initializing canvas chunks...');
      
      const chunks = [];
      for (let chunkX = 0; chunkX < 3; chunkX++) {
        for (let chunkY = 0; chunkY < 3; chunkY++) {
          chunks.push({
            chunkX,
            chunkY,
            pixels: new Array(2500).fill(0) // Initialize with color 0 (white/transparent)
          });
        }
      }
      
      await CanvasChunk.insertMany(chunks);
      console.log('Canvas chunks initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing canvas:', error);
  }
};

// Get complete canvas state by assembling all chunks
const getCompleteCanvas = async () => {
  try {
    const chunks = await CanvasChunk.find().sort({ chunkY: 1, chunkX: 1 });
    
    // Create 150x150 2D array
    const canvas = Array(150).fill(null).map(() => Array(150).fill(0));
    
    for (const chunk of chunks) {
      const { chunkX, chunkY, pixels } = chunk;
      
      // Fill the canvas with chunk data
      for (let localY = 0; localY < 50; localY++) {
        for (let localX = 0; localX < 50; localX++) {
          const globalX = chunkX * 50 + localX;
          const globalY = chunkY * 50 + localY;
          const pixelIndex = localY * 50 + localX;
          
          canvas[globalY][globalX] = pixels[pixelIndex];
        }
      }
    }
    
    return {
      width: 150,
      height: 150,
      pixels: canvas
    };
  } catch (error) {
    console.error('Error getting complete canvas:', error);
    throw error;
  }
};

// Update a single pixel in the appropriate chunk
const updatePixel = async (x, y, color) => {
  try {
    // Validate coordinates
    if (x < 0 || x >= 150 || y < 0 || y >= 150) {
      throw new Error('Coordinates out of bounds');
    }
    
    // Validate color
    if (color < 0 || color > 63) {
      throw new Error('Color must be between 0 and 63');
    }
    
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / 50);
    const chunkY = Math.floor(y / 50);
    
    // Calculate local coordinates within the chunk
    const localX = x % 50;
    const localY = y % 50;
    
    // Calculate array index
    const arrayIndex = localY * 50 + localX;
    
    // Update the specific pixel in the chunk
    const updateQuery = {};
    updateQuery[`pixels.${arrayIndex}`] = color;
    
    await CanvasChunk.updateOne(
      { chunkX, chunkY },
      { $set: updateQuery }
    );
    
    return { x, y, color };
  } catch (error) {
    console.error('Error updating pixel:', error);
    throw error;
  }
};

module.exports = {
  initializeCanvas,
  getCompleteCanvas,
  updatePixel
};