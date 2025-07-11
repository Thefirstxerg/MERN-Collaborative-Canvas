const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (userId, username) => {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw new Error('Invalid token');
  }
};

const getUser = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }
  
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    return user;
  } catch (error) {
    return null;
  }
};

const requireAuth = async (req) => {
  const user = await getUser(req);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
};

module.exports = {
  createToken,
  verifyToken,
  getUser,
  requireAuth
};