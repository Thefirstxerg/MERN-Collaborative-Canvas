# rDraw - Collaborative Pixel Art Canvas

A real-time collaborative pixel art application built with the MERN stack, featuring GraphQL API and WebSocket communication.

## Features

- **Real-time Collaboration**: Multiple users can paint on the same 150x150 canvas simultaneously
- **Pixel-perfect Experience**: Each user can place one pixel every 30 seconds
- **JWT Authentication**: Secure user registration and login system
- **5-bit Color Palette**: 32 beautiful colors to choose from
- **GraphQL API**: Single endpoint for all data operations
- **WebSocket Communication**: Instant updates across all connected clients
- **Chunk-based Storage**: Efficient MongoDB storage using 9 chunks of 50x50 pixels each

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Apollo Server** - GraphQL server
- **MongoDB** - Database with chunk-based canvas storage
- **WebSocket** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### Frontend
- **React** - UI library with TypeScript
- **Apollo Client** - GraphQL client
- **HTML5 Canvas** - Pixel art rendering
- **WebSocket** - Real-time updates

## Architecture

The application follows a clean separation between initial data loading and real-time updates:

1. **Initial Load**: Client fetches complete canvas state via GraphQL
2. **Authentication**: JWT-based user registration and login
3. **Real-time Updates**: WebSocket connection for instant pixel updates
4. **Pixel Placement**: GraphQL mutations with 30-second cooldown enforcement

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MERN-Collaborative-Canvas
   ```

2. **Install dependencies**
   ```bash
   npm run install
   ```

3. **Configure environment variables**
   
   Create `backend/.env` file:
   ```env
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/rdraw
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Start the application**
   ```bash
   # Development mode (both backend and frontend)
   npm run dev
   
   # Or start separately
   npm run dev:backend    # Backend on port 4000
   npm run dev:frontend   # Frontend on port 3000
   ```

## API Documentation

### GraphQL Endpoints

**Base URL**: `http://localhost:4000/graphql`

#### Queries

```graphql
# Get complete canvas state
query GetCanvasState {
  getCanvasState {
    width
    height
    pixels  # 150x150 2D array of color IDs (0-31)
  }
}

# Get current user info (requires authentication)
query Me {
  me {
    id
    username
    lastPixelPlacementTimestamp
  }
}
```

#### Mutations

```graphql
# Register new user
mutation RegisterUser($username: String!, $password: String!) {
  registerUser(username: $username, password: $password) {
    token
    user {
      id
      username
      lastPixelPlacementTimestamp
    }
  }
}

# Login user
mutation LoginUser($username: String!, $password: String!) {
  loginUser(username: $username, password: $password) {
    token
    user {
      id
      username
      lastPixelPlacementTimestamp
    }
  }
}

# Place pixel (requires authentication)
mutation PlacePixel($x: Int!, $y: Int!, $color: Int!) {
  placePixel(x: $x, y: $y, color: $color) {
    x
    y
    color
  }
}
```

### WebSocket Events

**WebSocket URL**: `ws://localhost:4000/ws`

#### Client to Server

```json
{
  "type": "AUTH",
  "token": "your-jwt-token"
}
```

#### Server to Client

```json
{
  "type": "PIXEL_UPDATE",
  "payload": {
    "x": 75,
    "y": 100,
    "color": 15
  }
}
```

## Database Schema

### Users Collection
```javascript
{
  "_id": ObjectId,
  "username": String,           // Unique username
  "password": String,           // Hashed password
  "lastPixelPlacementTimestamp": Date,
  "createdAt": Date,
  "updatedAt": Date
}
```

### Canvas Chunks Collection
```javascript
{
  "_id": ObjectId,
  "chunkX": Number,            // 0-2 (chunk X coordinate)
  "chunkY": Number,            // 0-2 (chunk Y coordinate) 
  "pixels": [Number],          // Array of 2500 color IDs (0-31)
  "createdAt": Date,
  "updatedAt": Date
}
```

## Usage

1. **Register/Login**: Create an account or log in with existing credentials
2. **Select Color**: Choose from the 32-color palette
3. **Place Pixel**: Click on the canvas to place a pixel
4. **Wait for Cooldown**: Each user can place one pixel every 30 seconds
5. **Watch Live Updates**: See other users' pixels appear in real-time

## Development

### Project Structure
```
/
├── backend/
│   ├── models/           # MongoDB models
│   ├── graphql/          # GraphQL schema and resolvers
│   ├── middleware/       # Authentication middleware
│   ├── utils/            # Canvas utilities
│   └── server.js         # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom hooks
│   │   └── utils/        # Utility functions
│   └── public/
└── package.json          # Root package.json
```

### Scripts

```bash
# Install all dependencies
npm run install

# Development mode
npm run dev

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend

# Build for production
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
