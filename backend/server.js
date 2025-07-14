require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const { initializeCanvas } = require('./utils/canvas');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rdraw';

async function startServer() {
  // Create Express app
  const app = express();
  const httpServer = createServer(app);

  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Initialize canvas chunks
    await initializeCanvas();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Please ensure MongoDB is running and accessible at:', MONGODB_URI);
    console.error('You can start MongoDB with: mongod');
    process.exit(1);
  }

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  // Setup WebSocket server
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
  });

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    // Handle WebSocket authentication
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'AUTH') {
          // Verify JWT token
          const token = data.token;
          if (token) {
            try {
              const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
              ws.userId = decoded.userId;
              ws.username = decoded.username;
              ws.authenticated = true;
              
              ws.send(JSON.stringify({
                type: 'AUTH_SUCCESS',
                payload: { username: decoded.username }
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'AUTH_ERROR',
                payload: { message: 'Invalid token' }
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  // Setup middleware - TEMPORARY: Allow all origins for testing
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());

  // Apply GraphQL middleware
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: ({ req }) => ({
        req,
        wss // Pass WebSocket server to resolvers
      })
    })
  );

  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Start the server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`🚀 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`🚀 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});