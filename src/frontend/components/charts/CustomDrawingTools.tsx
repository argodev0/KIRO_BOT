/**
 * Custom Drawing Tools Component
 * Provides advanced drawing tools for manual technical analysis
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  Timeline as TrendLineIcon,
  HorizontalRule as HorizontalLineIcon,
  CropFree as RectangleIcon,
  RadioButtonUnchecked as CircleIcon,
  ShowChart as FibonacciIcon,
  Straighten as MeasureIcon,
  TextFields as TextIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Palette as ColorIcon,
  LineWeight as LineWeightIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';

interface CustomDrawingToolsProps {
  chartWidget: any;
  onDrawingComplete?: (drawing: DrawingObject) => void;
  onDrawingDelete?: (drawingId: string) => void;
}

interface DrawingObject {
  id: string;
  type: DrawingType;
  points: Array<{ time: number; price: number }>;
  style: DrawingStyle;
  label?: string;
  created: number;
  modified: number;
}

interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  transparency?: number;
  fontSize?: number;
}

type DrawingType = 
  | 'trend_line'
  | 'horizontal_line'
  | 'vertical_line'
  | 'rectangle'
  | 'circle'
  | 'fibonacci_retracement'
  | 'fibonacci_extension'
  | 'fibonacci_fan'
  | 'fibonacci_arc'
  | 'text'
  | 'arrow'
  | 'measure';

const DRAWING_TOOLS: Array<{
  type: DrawingType;
  icon: React.ReactNode;
  label: string;
  category: 'lines' | 'shapes' | 'fibonacci' | 'annotations';
}> = [
  // Lines
  { type: 'trend_line', icon: <TrendLineIcon />, label: 'Trend Line', category: 'lines' },
  { type: 'horizontal_line', icon: <HorizontalLineIcon />, label: 'Horizontal Line', category: 'lines' },
  { type: 'vertical_line', icon: <HorizontalLineIcon style={{ transform: 'rotate(90deg)' }} />, label: 'Vertical Line', category: 'lines' },
  
  // Shapes
  { type: 'rectangle', icon: <RectangleIcon />, label: 'Rectangle', category: 'shapes' },
  { type: 'circle', icon: <CircleIcon />, label: 'Circle', category: 'shapes' },
  
  // Fibonacci
  { type: 'fibonacci_retracement', icon: <FibonacciIcon />, label: 'Fib Retracement', category: 'fibonacci' },
  { type: 'fibonacci_extension', icon: <FibonacciIcon />, label: 'Fib Extension', category: 'fibonacci' },
  { type: 'fibonacci_fan', icon: <FibonacciIcon />, label: 'Fib Fan', category: 'fibonacci' },
  { type: 'fibonacci_arc', icon: <FibonacciIcon />, label: 'Fib Arc', category: 'fibonacci' },
  
  // Annotations
  { type: 'text', icon: <TextIcon />, label: 'Text', category: 'annotations' },
  { type: 'measure', icon: <MeasureIcon />, label: 'Measure', category: 'annotations' },
];

const DEFAULT_COLORS = [
  '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
];

const CustomDrawingTools: React.FC<CustomDrawingToolsProps> = ({
  chartWidget,
  onDrawingComplete,
  onDrawingDelete
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>({
    color: '#FFFFFF',
    lineWidth: 2,
    lineStyle: 'solid',
    transparency: 0
  });
  
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  
  const drawingIdCounter = useRef(0);
  const undoStack = useRef<DrawingObject[][]>([]);
  const redoStack = useRef<DrawingObject[][]>([]);

  // Initialize drawing tools
  useEffect(() => {
    if (!chartWidget) return;

    try {
      const chart = chartWidget.chart();
      
      // Set up drawing event listeners
      chart.onDataLoaded().subscribe(null, () => {
        console.log('Chart data loaded, drawing tools ready');
      });

      // Enable drawing mode
      chart.createStudy('Drawing Toolbar', false, false);
      
    } catch (error) {
      console.warn('Failed to initialize drawing tools:', error);
    }
  }, [chartWidget]);

  // Handle tool selection
  const handleToolSelect = useCallback((toolType: DrawingType) => {
    if (!chartWidget) return;

    try {
      const chart = chartWidget.chart();
      
      // Deactivate previous tool
      if (activeTool) {
        chart.removeAllShapes();
      }

      // Activate new tool
      setActiveTool(toolType);
      
      // Configure chart for drawing
      switch (toolType) {
        case 'trend_line':
          chart.createShape(null, {
            shape: 'trend_line',
            overrides: {
              linecolor: currentStyle.color,
              linewidth: currentStyle.lineWidth,
              linestyle: getLineStyleValue(currentStyle.lineStyle)
            }
          });
          break;
          
        case 'horizontal_line':
          chart.createShape(null, {
            shape: 'horizontal_line',
            overrides: {
              linecolor: currentStyle.color,
              linewidth: currentStyle.lineWidth,
              linestyle: getLineStyleValue(currentStyle.lineStyle)
            }
          });
          break;
          
        case 'rectangle':
          chart.createShape(null, {
            shape: 'rectangle',
            overrides: {
              color: currentStyle.fillColor || currentStyle.color,
              transparency: currentStyle.transparency || 80,
              borderColor: currentStyle.color,
              borderWidth: currentStyle.lineWidth
            }
          });
          break;
          
        case 'fibonacci_retracement':
          chart.createStudy('Fibonacci Retracement', false, false, undefined, {
            'style.color': currentStyle.color,
            'style.linewidth': currentStyle.lineWidth
          });
          break;
          
        case 'text':
          chart.createShape(null, {
            shape: 'text',
            text: 'Click to edit',
            overrides: {
              color: currentStyle.color,
              fontsize: currentStyle.fontSize || 12,
              bold: false
            }
          });
          break;
          
        default:
          console.warn(`Tool ${toolType} not implemented yet`);
      }

    } catch (error) {
      console.error('Failed to activate drawing tool:', error);
    }
  }, [chartWidget, activeTool, currentStyle]);

  // Handle drawing completion
  const handleDrawingComplete = useCallback((drawingData: any) => {
    const drawing: DrawingObject = {
      id: `drawing_${++drawingIdCounter.current}`,
      type: activeTool!,
      points: drawingData.points || [],
      style: { ...currentStyle },
      created: Date.now(),
      modified: Date.now()
    };

    // Add to drawings list
    setDrawings(prev => {
      const newDrawings = [...prev, drawing];
      
      // Save to undo stack
      undoStack.current.push([...prev]);
      if (undoStack.current.length > 50) {
        undoStack.current.shift();
      }
      redoStack.current = []; // Clear redo stack
      
      return newDrawings;
    });

    // Notify parent
    if (onDrawingComplete) {
      onDrawingComplete(drawing);
    }

    // Deactivate tool
    setActiveTool(null);
  }, [activeTool, currentStyle, onDrawingComplete]);

  // Delete drawing
  const handleDeleteDrawing = useCallback((drawingId: string) => {
    setDrawings(prev => {
      const newDrawings = prev.filter(d => d.id !== drawingId);
      
      // Save to undo stack
      undoStack.current.push([...prev]);
      if (undoStack.current.length > 50) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      
      return newDrawings;
    });

    // Remove from chart
    if (chartWidget) {
      try {
        const chart = chartWidget.chart();
        chart.removeEntity(drawingId);
      } catch (error) {
        console.warn('Failed to remove drawing from chart:', error);
      }
    }

    // Notify parent
    if (onDrawingDelete) {
      onDrawingDelete(drawingId);
    }
  }, [chartWidget, onDrawingDelete]);

  // Undo/Redo functionality
  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;

    const previousState = undoStack.current.pop()!;
    redoStack.current.push([...drawings]);
    setDrawings(previousState);
  }, [drawings]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;

    const nextState = redoStack.current.pop()!;
    undoStack.current.push([...drawings]);
    setDrawings(nextState);
  }, [drawings]);

  // Clear all drawings
  const handleClearAll = useCallback(() => {
    if (drawings.length === 0) return;

    // Save to undo stack
    undoStack.current.push([...drawings]);
    redoStack.current = [];
    
    setDrawings([]);

    // Clear from chart
    if (chartWidget) {
      try {
        const chart = chartWidget.chart();
        drawings.forEach(drawing => {
          chart.removeEntity(drawing.id);
        });
      } catch (error) {
        console.warn('Failed to clear drawings from chart:', error);
      }
    }
  }, [drawings, chartWidget]);

  // Save/Load drawings
  const handleSaveDrawings = useCallback(() => {
    const drawingsData = {
      drawings,
      timestamp: Date.now(),
      symbol: 'BTCUSDT' // This would come from props
    };
    
    localStorage.setItem('chart_drawings', JSON.stringify(drawingsData));
    console.log('Drawings saved to localStorage');
  }, [drawings]);

  const handleLoadDrawings = useCallback(() => {
    try {
      const saved = localStorage.getItem('chart_drawings');
      if (saved) {
        const drawingsData = JSON.parse(saved);
        setDrawings(drawingsData.drawings || []);
        console.log('Drawings loaded from localStorage');
      }
    } catch (error) {
      console.error('Failed to load drawings:', error);
    }
  }, []);

  // Style change handlers
  const handleColorChange = (color: string) => {
    setCurrentStyle(prev => ({ ...prev, color }));
    setColorMenuAnchor(null);
  };

  const handleLineWidthChange = (width: number) => {
    setCurrentStyle(prev => ({ ...prev, lineWidth: width }));
  };

  if (!isVisible) {
    return (
      <IconButton
        onClick={() => setIsVisible(true)}
        sx={{
          position: 'absolute',
          top: 120,
          left: 10,
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          color: '#fff',
          '&:hover': { backgroundColor: 'rgba(26, 26, 26, 1)' }
        }}
      >
        <ShowChartIcon />
      </IconButton>
    );
  }

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 120,
        left: 10,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderRadius: 2,
        p: 1,
        minWidth: 60,
        backdropFilter: 'blur(10px)',
        border: '1px solid #2a2a2a',
        zIndex: 1000
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold' }}>
          Drawing Tools
        </Typography>
        <IconButton
          size="small"
          onClick={() => setIsVisible(false)}
          sx={{ color: '#666' }}
        >
          ×
        </IconButton>
      </Box>

      {/* Tool Categories */}
      <Stack spacing={1}>
        {/* Lines */}
        <Box>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
            Lines
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {DRAWING_TOOLS.filter(tool => tool.category === 'lines').map(tool => (
              <Tooltip key={tool.type} title={tool.label}>
                <IconButton
                  size="small"
                  onClick={() => handleToolSelect(tool.type)}
                  sx={{
                    color: activeTool === tool.type ? '#4ECDC4' : '#fff',
                    backgroundColor: activeTool === tool.type ? 'rgba(78, 205, 196, 0.2)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
                  }}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Box>

        {/* Shapes */}
        <Box>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
            Shapes
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {DRAWING_TOOLS.filter(tool => tool.category === 'shapes').map(tool => (
              <Tooltip key={tool.type} title={tool.label}>
                <IconButton
                  size="small"
                  onClick={() => handleToolSelect(tool.type)}
                  sx={{
                    color: activeTool === tool.type ? '#4ECDC4' : '#fff',
                    backgroundColor: activeTool === tool.type ? 'rgba(78, 205, 196, 0.2)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(78, 205, 196, 0.1)' }
                  }}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Box>

        {/* Fibonacci */}
        <Box>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
            Fibonacci
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            {DRAWING_TOOLS.filter(tool => tool.category === 'fibonacci').map(tool => (
              <Tooltip key={tool.type} title={tool.label}>
                <IconButton
                  size="small"
                  onClick={() => handleToolSelect(tool.type)}
                  sx={{
                    color: activeTool === tool.type ? '#FFD700' : '#fff',
                    backgroundColor: activeTool === tool.type ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.1)' }
                  }}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ backgroundColor: '#2a2a2a' }} />

        {/* Style Controls */}
        <Box>
          <Typography variant="caption" sx={{ color: '#aaa', fontSize: '0.7rem' }}>
            Style
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {/* Color Picker */}
            <Tooltip title="Color">
              <IconButton
                size="small"
                onClick={(e) => setColorMenuAnchor(e.currentTarget)}
                sx={{
                  color: currentStyle.color,
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                }}
              >
                <ColorIcon />
              </IconButton>
            </Tooltip>

            {/* Line Width */}
            <Tooltip title="Line Width">
              <IconButton
                size="small"
                onClick={() => handleLineWidthChange(currentStyle.lineWidth === 1 ? 2 : currentStyle.lineWidth === 2 ? 3 : 1)}
                sx={{ color: '#fff' }}
              >
                <LineWeightIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Divider sx={{ backgroundColor: '#2a2a2a' }} />

        {/* Action Controls */}
        <Stack direction="row" spacing={0.5} justifyContent="space-between">
          <Tooltip title="Undo">
            <IconButton
              size="small"
              onClick={handleUndo}
              disabled={undoStack.current.length === 0}
              sx={{ color: undoStack.current.length > 0 ? '#fff' : '#666' }}
            >
              <UndoIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Redo">
            <IconButton
              size="small"
              onClick={handleRedo}
              disabled={redoStack.current.length === 0}
              sx={{ color: redoStack.current.length > 0 ? '#fff' : '#666' }}
            >
              <RedoIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="More Options">
            <IconButton
              size="small"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{ color: '#fff' }}
            >
              <MoreIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Drawing Count */}
        {drawings.length > 0 && (
          <Chip
            label={`${drawings.length} drawing${drawings.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              backgroundColor: 'rgba(78, 205, 196, 0.2)',
              color: '#4ECDC4',
              fontSize: '0.7rem'
            }}
          />
        )}
      </Stack>

      {/* Color Menu */}
      <Menu
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={() => setColorMenuAnchor(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            color: '#fff'
          }
        }}
      >
        <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
          {DEFAULT_COLORS.map(color => (
            <Box
              key={color}
              onClick={() => handleColorChange(color)}
              sx={{
                width: 24,
                height: 24,
                backgroundColor: color,
                borderRadius: 1,
                cursor: 'pointer',
                border: currentStyle.color === color ? '2px solid #4ECDC4' : '1px solid #666',
                '&:hover': { transform: 'scale(1.1)' }
              }}
            />
          ))}
        </Box>
      </Menu>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            color: '#fff'
          }
        }}
      >
        <MenuItem onClick={handleSaveDrawings}>
          <ListItemIcon>
            <SaveIcon sx={{ color: '#fff' }} />
          </ListItemIcon>
          <ListItemText primary="Save Drawings" />
        </MenuItem>
        
        <MenuItem onClick={handleLoadDrawings}>
          <ListItemIcon>
            <LoadIcon sx={{ color: '#fff' }} />
          </ListItemIcon>
          <ListItemText primary="Load Drawings" />
        </MenuItem>
        
        <MenuItem onClick={handleClearAll} disabled={drawings.length === 0}>
          <ListItemIcon>
            <DeleteIcon sx={{ color: drawings.length > 0 ? '#ff6b6b' : '#666' }} />
          </ListItemIcon>
          <ListItemText primary="Clear All" />
        </MenuItem>
      </Menu>
    </Paper>
  );
};

// Helper function to convert line style to TradingView value
function getLineStyleValue(style: 'solid' | 'dashed' | 'dotted'): number {
  switch (style) {
    case 'solid': return 0;
    case 'dashed': return 1;
    case 'dotted': return 2;
    default: return 0;
  }
}

export default CustomDrawingTools;