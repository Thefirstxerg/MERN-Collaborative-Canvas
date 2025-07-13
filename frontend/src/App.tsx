import React from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import Canvas from './components/Canvas';
import Auth from './components/Auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// Create HTTP link
const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql',
});

// Create auth link
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Create Apollo Client
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function AppContent() {
  const { user, logout } = useAuth();
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>rDraw - Collaborative Canvas</h1>
        <div className="header-content">
          {user && (
            <div className="user-info">
              <span>Welcome, {user.username}!</span>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main>
        {user ? <Canvas /> : <Auth />}
      </main>
    </div>
  );
}

function App() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;
