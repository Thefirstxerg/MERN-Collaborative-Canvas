import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Loading from './Loading';

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

const Canvas = () => {
  const { token, user, updateUser } = useAuth();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [pixelGrid, setPixelGrid] = useState([]);
  const [status, setStatus] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });

  const { data: canvasData, loading, error } = useQuery(GET_CANVAS_STATE);
  const [placePixel, { loading: placingPixel }] = useMutation(PLACE_PIXEL);

  // WebSocket connection
  const { lastMessage, isConnected } = useWebSocket(
    'wss://mern-collaborative-canvas.onrender.com/ws',
    token
  );

  // Initialize canvas when data is loaded
  useEffect(() => {
    if (canvasData?.getCanvasState) {
      setPixelGrid(canvasData.getCanvasState.pixels);
    }
  }, [canvasData]);

  // Set up canvas size based on window size
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Calculate available space (account for sidebar and padding)
        const availableWidth = rect.width - 40; // Account for padding
        const availableHeight = rect.height - 40; // Account for padding
        
        // Make canvas take up most of the available space
        const canvasWidth = Math.min(availableWidth, availableHeight);
        const canvasHeight = canvasWidth; // Square canvas
        
        setCanvasSize({
          width: Math.max(canvasWidth, 400), // Minimum size
          height: Math.max(canvasHeight, 400)
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (user?.lastPixelPlacementTimestamp) {
      const updateCooldown = () => {
        const now = Date.now();
        const lastPlacement = new Date(user.lastPixelPlacementTimestamp).getTime();
        const cooldownMs = 10 * 1000; // 10 seconds
        const elapsed = now - lastPlacement;
        const remaining = Math.max(0, cooldownMs - elapsed);
        
        setCooldownRemaining(Math.ceil(remaining / 1000));
        
        if (remaining > 0) {
          setTimeout(updateCooldown, 1000);
        }
      };
      
      updateCooldown();
    }
  }, [user?.lastPixelPlacementTimestamp, pixelGrid]); // Update when a new pixel is placed

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

      // Apply zoom and pan transformations
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Calculate pixel size based on canvas size
      const pixelSize = Math.min(canvasSize.width / 150, canvasSize.height / 150);

      // Disable image smoothing for crisp pixels
      ctx.imageSmoothingEnabled = false;

      // Draw pixels without borders
      for (let y = 0; y < 150; y++) {
        for (let x = 0; x < 150; x++) {
          const colorIndex = pixelGrid[y][x];
          ctx.fillStyle = COLOR_PALETTE[colorIndex];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }

      ctx.restore();
    }
  }, [pixelGrid, zoom, pan, canvasSize]);

  const handleCanvasClick = async (e) => {
    if (!canvasRef.current || cooldownRemaining > 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const pixelSize = Math.min(canvasSize.width / 150, canvasSize.height / 150);
    
    // Calculate click position considering zoom and pan
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    
    const x = Math.floor(mouseX / pixelSize);
    const y = Math.floor(mouseY / pixelSize);

    if (x < 0 || x >= 150 || y < 0 || y >= 150) return;

    try {
      await placePixel({
        variables: { x, y, color: selectedColor },
      });
      
      // Update user's last pixel placement timestamp
      updateUser({
        lastPixelPlacementTimestamp: new Date().toISOString()
      });
      
      setStatus({ type: 'success', message: 'Pixel placed successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to place pixel' });
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (loading) return <Loading message="Loading canvas..." />;
  if (error) return <div className="error">Error loading canvas: {error.message}</div>;
  if (!pixelGrid.length) return <Loading message="Initializing canvas..." />;

  return (
    <div className="canvas-container">
      <div className="canvas-sidebar">
        <div className="color-palette">
          <h3>Color Palette</h3>
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
        
        <div className="canvas-info">
          <h3>Instructions</h3>
          <p>• Click to place a pixel</p>
          <p>• Drag to pan the canvas</p>
          <p>• Scroll to zoom in/out</p>
          <p>• 10 second cooldown between pixels</p>
        </div>
        
        <div className="canvas-controls">
          <div className="selected-color-info">
            <span>Selected Color: {selectedColor}</span>
            <div 
              className="selected-color-preview"
              style={{ backgroundColor: COLOR_PALETTE[selectedColor] }}
            />
          </div>
          
          <div className="websocket-status">
            <span>WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected'}</span>
          </div>
          
          <div className={`cooldown-timer ${cooldownRemaining > 0 ? 'active' : 'ready'}`}>
            {cooldownRemaining > 0 ? (
              <span>Cooldown: {cooldownRemaining}s</span>
            ) : (
              <span>Ready to place pixel!</span>
            )}
          </div>
          
          <button onClick={resetView} className="reset-view-btn">
            Reset View
          </button>
        </div>
      </div>
      
      <div className="canvas-main" ref={containerRef}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="canvas-board"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{
            touchAction: 'none',
            userSelect: 'none'
          }}
        />
        
        {(status || placingPixel) && (
          <div className={`status ${status?.type || 'success'}`}>
            {placingPixel ? 'Placing pixel...' : status?.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;