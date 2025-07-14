const { gql } = require('graphql-tag');

const typeDefs = gql`
  # The full state of the canvas, assembled on the server
  type Canvas {
    width: Int!
    height: Int!
    pixels: [[Int!]!]!
  }

  # User information
  type User {
    id: ID!
    username: String!
    lastPixelPlacementTimestamp: String
    pixelCount: Int!
  }

  # Leaderboard entry
  type LeaderboardEntry {
    id: ID!
    username: String!
    pixelCount: Int!
    waitingTimeSeconds: Int!
  }

  # The payload returned upon successful authentication
  type AuthPayload {
    token: String!
    user: User!
  }

  # The result of placing a pixel
  type Pixel {
    x: Int!
    y: Int!
    color: Int!
  }

  # Queries for fetching data
  type Query {
    # Fetches the entire canvas state for initial load
    getCanvasState: Canvas!
    
    # Fetches the current authenticated user's profile
    me: User
    
    # Fetches the leaderboard (top 10 users by pixel count)
    getLeaderboard: [LeaderboardEntry!]!
  }

  # Mutations for changing state
  type Mutation {
    # Registers a new user
    registerUser(username: String!, password: String!): AuthPayload!
    
    # Logs in an existing user
    loginUser(username: String!, password: String!): AuthPayload!
    
    # Places a single pixel on the canvas
    placePixel(x: Int!, y: Int!, color: Int!): Pixel!
  }
`;

module.exports = typeDefs;