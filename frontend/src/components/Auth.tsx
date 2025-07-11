import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';

const REGISTER_USER = gql`
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
`;

const LOGIN_USER = gql`
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
`;

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const [registerUser, { loading: registerLoading }] = useMutation(REGISTER_USER);
  const [loginUser, { loading: loginLoading }] = useMutation(LOGIN_USER);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      const mutation = isLogin ? loginUser : registerUser;
      const { data } = await mutation({
        variables: { username, password },
      });

      const result = data[isLogin ? 'loginUser' : 'registerUser'];
      login(result.token, result.user);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const loading = registerLoading || loginLoading;

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      <div className="auth-toggle">
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          disabled={loading}
        >
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
};

export default Auth;