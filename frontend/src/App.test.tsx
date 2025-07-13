import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders canvas application', () => {
  render(<App />);
  const linkElement = screen.getByText(/rDraw - Collaborative Canvas/i);
  expect(linkElement).toBeInTheDocument();
});
