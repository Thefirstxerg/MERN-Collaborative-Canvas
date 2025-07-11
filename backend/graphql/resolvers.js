const User = require('../models/User');
const { createToken, requireAuth, getUser } = require('../middleware/auth');
const { getCompleteCanvas, updatePixel } = require('../utils/canvas');

const resolvers = {
  Query: {
    getCanvasState: async () => {
      try {
        return await getCompleteCanvas();
      } catch (error) {
        throw new Error('Failed to fetch canvas state');
      }
    },
    
    me: async (parent, args, context) => {
      try {
        const user = await getUser(context.req);
        return user;
      } catch (error) {
        return null;
      }
    }
  },

  Mutation: {
    registerUser: async (parent, { username, password }) => {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          throw new Error('Username already exists');
        }

        // Create new user
        const user = new User({ username, password });
        await user.save();

        // Generate token
        const token = createToken(user._id, user.username);

        return {
          token,
          user: {
            id: user._id,
            username: user.username,
            lastPixelPlacementTimestamp: user.lastPixelPlacementTimestamp
          }
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to register user');
      }
    },

    loginUser: async (parent, { username, password }) => {
      try {
        // Find user
        const user = await User.findOne({ username });
        if (!user) {
          throw new Error('Invalid username or password');
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          throw new Error('Invalid username or password');
        }

        // Generate token
        const token = createToken(user._id, user.username);

        return {
          token,
          user: {
            id: user._id,
            username: user.username,
            lastPixelPlacementTimestamp: user.lastPixelPlacementTimestamp
          }
        };
      } catch (error) {
        throw new Error(error.message || 'Failed to login');
      }
    },

    placePixel: async (parent, { x, y, color }, context) => {
      try {
        // Require authentication
        const user = await requireAuth(context.req);

        // Check cooldown
        const now = new Date();
        if (user.lastPixelPlacementTimestamp) {
          const timeSinceLastPlacement = now - user.lastPixelPlacementTimestamp;
          const cooldownMs = 30 * 1000; // 30 seconds

          if (timeSinceLastPlacement < cooldownMs) {
            const remainingTime = Math.ceil((cooldownMs - timeSinceLastPlacement) / 1000);
            throw new Error(`Cooldown active. Please wait ${remainingTime} seconds.`);
          }
        }

        // Update pixel in canvas
        const pixel = await updatePixel(x, y, color);

        // Update user's last placement timestamp
        await User.findByIdAndUpdate(user._id, {
          lastPixelPlacementTimestamp: now
        });

        // Broadcast the pixel update via WebSocket
        if (context.wss) {
          const message = JSON.stringify({
            type: 'PIXEL_UPDATE',
            payload: pixel
          });
          
          context.wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(message);
            }
          });
        }

        return pixel;
      } catch (error) {
        throw new Error(error.message || 'Failed to place pixel');
      }
    }
  }
};

module.exports = resolvers;