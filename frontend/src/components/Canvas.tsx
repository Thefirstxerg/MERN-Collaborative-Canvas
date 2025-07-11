import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

const GET_CANVAS_STATE = gql`
  query GetCanvasState {
    getCanvasState {
      width
      height
      pixels
    }
  }
`;

const PLACE_PIXEL = gql`
  mutation PlacePixel($x: Int!, $y: Int!, $color: Int!) {
    placePixel(x: $x, y: $y, color: $color) {
      x
      y
      color
    }
  }
`;

// 5-bit color palette (32 colors)
const COLOR_PALETTE = [
  '#FFFFFF', '#E4E4E4', '#888888', '#222222', // Grays
  '#FFA7D1', '#E50000', '#E59500', '#A06A42', // Reds/Oranges
  '#E5D900', '#94E044', '#02BE01', '#00D3DD', // Yellows/Greens
  '#0083C7', '#0000EA', '#CF6EE4', '#820080', // Blues/Purples
  '#FFB470', '#FF6A00', '#BE0039', '#6D001A', // More oranges/reds
  '#B44C43', '#DE107F', '#FF3881', '#FF99AA', // Pinks
  '#6D482F', '#9C6926', '#FFD635', '#FFF8B8', // Browns/Yellows
  '#00A368', '#00CC78', '#7EED56', '#00756F', // Greens/Teals
  '#009EAA', '#00CCC0', '#2450A4', '#3690EA', // Blues
  '#51E9F4', '#493AC1', '#6A5CFF', '#94B3FF'  // Light blues/purples
];

const Canvas: React.FC = () => {
  const { token } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [pixelGrid, setPixelGrid] = useState<number[][]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'cooldown'; message: string } | null>(null);
  const [scale] = useState(3); // 3x scale for better visibility

  const { data: canvasData, loading, error } = useQuery(GET_CANVAS_STATE);
  const [placePixel] = useMutation(PLACE_PIXEL);

  // WebSocket connection
  const { lastMessage, isConnected } = useWebSocket(
    'ws://localhost:4000/ws',
    token
  );

  // Initialize canvas when data is loaded
  useEffect(() => {
    if (canvasData?.getCanvasState) {
      setPixelGrid(canvasData.getCanvasState.pixels);
    }
  }, [canvasData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage && pixelGrid.length > 0) {
      try {
        const message = JSON.parse(lastMessage);
        if (message.type === 'PIXEL_UPDATE') {
          const { x, y, color } = message.payload;
          setPixelGrid(prev => {
            const newGrid = [...prev];
            newGrid[y] = [...newGrid[y]];
            newGrid[y][x] = color;
            return newGrid;
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, pixelGrid.length]);

  // Draw canvas
  useEffect(() => {
    if (canvasRef.current && pixelGrid.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pixels
      for (let y = 0; y < 150; y++) {
        for (let x = 0; x < 150; x++) {
          const colorIndex = pixelGrid[y][x];
          ctx.fillStyle = COLOR_PALETTE[colorIndex];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }, [pixelGrid, scale]);

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);

    if (x < 0 || x >= 150 || y < 0 || y >= 150) return;

    try {
      await placePixel({
        variables: { x, y, color: selectedColor },
      });
      
      setStatus({ type: 'success', message: 'Pixel placed successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to place pixel' });
      setTimeout(() => setStatus(null), 5000);
    }
  };

  if (loading) return <div>Loading canvas...</div>;
  if (error) return <div>Error loading canvas: {error.message}</div>;
  if (!pixelGrid.length) return <div>No canvas data</div>;

  return (
    <div className="canvas-container">
      <div className="canvas-controls">
        <div className="color-palette">
          {COLOR_PALETTE.map((color, index) => (
            <div
              key={index}
              className={`color-option ${selectedColor === index ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(index)}
              title={`Color ${index}`}
            />
          ))}
        </div>
        <div>
          <strong>Selected Color:</strong> {selectedColor} 
          <span 
            style={{ 
              display: 'inline-block', 
              width: '20px', 
              height: '20px', 
              backgroundColor: COLOR_PALETTE[selectedColor],
              border: '1px solid #000',
              marginLeft: '10px',
              verticalAlign: 'middle'
            }}
          />
        </div>
        <div>
          <strong>WebSocket:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={150 * scale}
        height={150 * scale}
        className="canvas-board"
        onClick={handleCanvasClick}
      />
      
      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}
      
      <div className="canvas-info">
        <p>Click on the canvas to place a pixel with the selected color.</p>
        <p>You can place one pixel every 30 seconds.</p>
      </div>
    </div>
  );
};

export default Canvas;