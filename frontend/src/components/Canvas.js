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

// 64-color palette - original 40 colors + 24 new unique colors
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
  '#51E9F4', '#493AC1', '#6A5CFF', '#94B3FF', // Light blues/purples
  // Additional 24 unique colors to complete 64-color palette
  '#FF69B4', '#FF1493', '#DC143C', '#B22222', // Deep pinks/reds
  '#FF4500', '#FF8C00', '#FFA500', '#FFD700', // Oranges/golds
  '#ADFF2F', '#32CD32', '#228B22', '#006400', // Lime/forest greens
  '#40E0D0', '#00CED1', '#008B8B', '#2F4F4F', // Turquoise/dark slate
  '#87CEEB', '#4169E1', '#0000CD', '#191970', // Sky blues/midnight
  '#9370DB', '#8A2BE2', '#4B0082', '#000000'  // Violets/indigo/black
];

const Canvas = () => {
  const { token, user, updateUser } = useAuth();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState(() => {
    const saved = localStorage.getItem('selectedColor');
    return saved !== null ? parseInt(saved, 10) : 0;
  });
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
        const availableWidth = rect.width - 20; // Account for padding
        const availableHeight = rect.height - 20; // Account for padding
        
        // Make canvas take up most of the available space, but keep it square
        // Use Math.min to ensure canvas fits within available space
        const canvasSize = Math.min(availableWidth, availableHeight);
        
        // Always update canvas size, ensuring minimum size
        const newSize = Math.max(canvasSize, 400);
        setCanvasSize(prevSize => {
          // Only update if the size has actually changed to prevent unnecessary re-renders
          if (prevSize.width !== newSize || prevSize.height !== newSize) {
            return {
              width: newSize,
              height: newSize
            };
          }
          return prevSize;
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (user?.lastPixelPlacementTimestamp && !user?.isAdmin) {
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
    } else if (user?.isAdmin) {
      setCooldownRemaining(0); // Admins have no cooldown
    }
  }, [user?.lastPixelPlacementTimestamp, user?.isAdmin, pixelGrid]); // Update when a new pixel is placed

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

  const handleCanvasRightClick = async (e) => {
    e.preventDefault(); // Prevent default context menu
    if (!canvasRef.current || (!user?.isAdmin && cooldownRemaining > 0)) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get the actual canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate the scaling factors
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    
    // Calculate click position relative to canvas
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    // Calculate pixel size based on actual canvas size
    const pixelSize = Math.min(canvasWidth / 150, canvasHeight / 150);
    
    // Calculate click position considering zoom and pan
    const mouseX = (clickX - pan.x) / zoom;
    const mouseY = (clickY - pan.y) / zoom;
    
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
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5);
    
    // Calculate the zoom center point
    const zoomFactor = newZoom / zoom;
    
    // Adjust pan to zoom towards mouse position
    const newPanX = mouseX - (mouseX - pan.x) * zoomFactor;
    const newPanY = mouseY - (mouseY - pan.y) * zoomFactor;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleColorSelect = (colorIndex) => {
    setSelectedColor(colorIndex);
    localStorage.setItem('selectedColor', colorIndex.toString());
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
              onClick={() => handleColorSelect(index)}
              title={`Color ${index}`}
            />
          ))}
        </div>
        
        <div className="canvas-info">
          <h3>Instructions</h3>
          <p>• Right-click to place a pixel</p>
          <p>• Left-click and drag to pan the canvas</p>
          <p>• Scroll to zoom in/out</p>
          <p>• 64 colors available</p>
          <p>• 10 second cooldown between pixels</p>
          <p>• Color selection persists across sessions</p>
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
            {user?.isAdmin ? (
              <span>Admin: No cooldown! 🚀</span>
            ) : cooldownRemaining > 0 ? (
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
          onContextMenu={handleCanvasRightClick}
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