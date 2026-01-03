import React, { useRef, useEffect, useState } from 'react';
import { AnimationSettings, CanvasExportData, MarkerPoint, SegmentTiming, ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT, CameraTransition } from '@/types';
import { cn } from '@/lib/utils';

// Helper types for geometry
type Point = { x: number; y: number };
// Updated Path to include stroke weight based on original image intensity
type Path = { 
    points: Point[]; 
    strength: number; 
};

interface WhiteboardCanvasProps {
  layers: ImageLayer[];
  previousLayers?: ImageLayer[]; // Layers for the previous frame (for transitions)
  transition?: CameraTransition;
  isPlaying: boolean;
  progress: number;
  speed: number;
  settings: AnimationSettings;
  customMarkers?: MarkerPoint[];
  segmentTimings?: SegmentTiming[];
  onProgressChange: (p: number) => void;
  onComplete: () => void;
  onExportDataReady: (data: CanvasExportData) => void;
  className?: string;
  style?: React.CSSProperties;
}

// 3D Fluency Style Hand for "Realistic" Mode
const REALISTIC_HAND_URL = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Writing%20Hand.png";

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  layers,
  previousLayers = [],
  transition,
  progress,
  settings,
  onExportDataReady,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [totalPathLength, setTotalPathLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Composite canvas used for coloring phase
  const [compositeCanvas, setCompositeCanvas] = useState<HTMLCanvasElement | null>(null);
  // Composite canvas for previous frame (transition)
  const [prevCompositeCanvas, setPrevCompositeCanvas] = useState<HTMLCanvasElement | null>(null);
  
  // Hand Image for Realistic Mode
  const [handImage, setHandImage] = useState<HTMLImageElement | null>(null);

  // Load Hand Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = REALISTIC_HAND_URL;
    img.onload = () => setHandImage(img);
  }, []);

  // -------------------------------------------------------------------------
  // Helper to render a composite canvas from layers
  // -------------------------------------------------------------------------
  const renderComposite = (targetLayers: ImageLayer[]): HTMLCanvasElement | null => {
     if (targetLayers.length === 0) return null;
     const canvas = document.createElement('canvas');
     canvas.width = CANVAS_WIDTH;
     canvas.height = CANVAS_HEIGHT;
     const ctx = canvas.getContext('2d');
     if (!ctx) return null;

     ctx.fillStyle = '#ffffff'; 
     ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
     
     targetLayers.forEach(layer => {
       try {
         ctx.save();
         const centerX = layer.x + layer.width / 2;
         const centerY = layer.y + layer.height / 2;
         ctx.translate(centerX, centerY);
         ctx.rotate((layer.rotation || 0) * Math.PI / 180);
         ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
         ctx.drawImage(layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
         ctx.restore();
       } catch (e) {
         console.error("Failed to draw layer", e);
       }
     });
     return canvas;
  };

  // -------------------------------------------------------------------------
  // 1. Layer Composition (For Coloring Phase & Transitions)
  // -------------------------------------------------------------------------
  useEffect(() => {
    setCompositeCanvas(renderComposite(layers));
  }, [layers]);

  useEffect(() => {
    setPrevCompositeCanvas(renderComposite(previousLayers));
  }, [previousLayers]);

  // -------------------------------------------------------------------------
  // 2. Sequential Image Processing (Sketch Generation)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (layers.length === 0) {
        setPaths([]);
        setTotalPathLength(0);
        return;
    }

    const processLayers = async () => {
      setIsProcessing(true);
      let allPaths: Path[] = [];
      let totalLen = 0;

      // Helper to process a single canvas (representing one layer)
      const processCanvas = (canvas: HTMLCanvasElement): Path[] => {
          const w = canvas.width;
          const h = canvas.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return [];

          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          
          // Grayscale conversion
          const gray = new Uint8Array(w * h);
          for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }

          // Sobel Kernels
          const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
          const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

          // Buffers for gradients
          const magnitudes = new Float32Array(w * h);
          const directions = new Float32Array(w * h);

          // 1. Calculate Gradients
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              let pixelX = 0;
              let pixelY = 0;
              let k = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const val = gray[(y + ky) * w + (x + kx)];
                  pixelX += val * kernelX[k];
                  pixelY += val * kernelY[k];
                  k++;
                }
              }
              
              const mag = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
              magnitudes[y * w + x] = mag;
              
              // Gradient direction in degrees
              let angle = Math.atan2(pixelY, pixelX) * (180 / Math.PI);
              if (angle < 0) angle += 180; // Normalize 0-180
              
              // Quantize angle to 0, 45, 90, 135
              if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                directions[y * w + x] = 0;
              } else if (angle >= 22.5 && angle < 67.5) {
                directions[y * w + x] = 45;
              } else if (angle >= 67.5 && angle < 112.5) {
                directions[y * w + x] = 90;
              } else if (angle >= 112.5 && angle < 157.5) {
                directions[y * w + x] = 135;
              }
            }
          }

          // 2. Non-Maximum Suppression (Thin lines to 1px)
          const edges = new Uint8Array(w * h);
          const threshold = 120 - (settings.edgeSensitivity * 100); 

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
               const idx = y * w + x;
               const mag = magnitudes[idx];
               if (mag < threshold) continue;

               const q = directions[idx];
               let m1 = 0, m2 = 0;

               // Compare with neighbors along the gradient direction
               if (q === 0) { // Horizontal gradient -> Vertical edge
                   m1 = magnitudes[idx - 1]; 
                   m2 = magnitudes[idx + 1]; 
               } else if (q === 90) { // Vertical gradient -> Horizontal edge
                   m1 = magnitudes[idx - w]; 
                   m2 = magnitudes[idx + w]; 
               } else if (q === 45) { // Diagonal 
                   m1 = magnitudes[idx - w - 1]; // Top-Left
                   m2 = magnitudes[idx + w + 1]; // Bottom-Right
               } else { // 135 Diagonal
                   m1 = magnitudes[idx - w + 1]; // Top-Right
                   m2 = magnitudes[idx + w - 1]; // Bottom-Left
               }

               // Suppress if not local maximum
               if (mag >= m1 && mag >= m2) {
                   edges[idx] = 1;
               }
            }
          }

          // 3. Path Tracing (Vectorization)
          const visited = new Uint8Array(w * h);
          const layerPaths: Path[] = [];
          const neighbors = [
            { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
            { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
          ];

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = y * w + x;
              if (edges[idx] && !visited[idx]) {
                const currentPath: Point[] = [];
                let currX = x;
                let currY = y;
                let tracing = true;
                let pathMagSum = 0;

                while (tracing) {
                   const cIdx = currY * w + currX;
                   visited[cIdx] = 1;
                   currentPath.push({ x: currX / w, y: currY / h }); 
                   pathMagSum += magnitudes[cIdx];
                   tracing = false;
                   
                   // Greedily find next edge pixel
                   for (const {dx, dy} of neighbors) {
                     const nx = currX + dx;
                     const ny = currY + dy;
                     if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) {
                       const nIdx = ny * w + nx;
                       if (edges[nIdx] && !visited[nIdx]) {
                         currX = nx;
                         currY = ny;
                         tracing = true;
                         break; 
                       }
                     }
                   }
                }

                if (currentPath.length > 5) { 
                  // Calculate stroke strength based on average gradient magnitude
                  const avgMag = pathMagSum / currentPath.length;
                  const strength = Math.min(Math.max(avgMag / 150, 0.5), 2.0);
                  
                  layerPaths.push({ points: currentPath, strength });
                }
              }
            }
          }
          
          // Sort paths top-to-bottom within this layer for natural drawing order
          layerPaths.sort((a, b) => (a.points[0].y + a.points[0].x * 0.1) - (b.points[0].y + b.points[0].x * 0.1));
          
          // Smooth paths
          if (settings.strokeSmoothness > 0) {
            const iterations = Math.ceil(settings.strokeSmoothness * 2);
            for (let iter = 0; iter < iterations; iter++) {
              for (const pathObj of layerPaths) {
                const path = pathObj.points;
                if (path.length < 3) continue;
                for (let i = 1; i < path.length - 1; i++) {
                  path[i].x = (path[i-1].x + 2*path[i].x + path[i+1].x) / 4;
                  path[i].y = (path[i-1].y + 2*path[i].y + path[i+1].y) / 4;
                }
              }
            }
          }

          return layerPaths;
      };

      // Iterate through layers sequentially
      for (const layer of layers) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = CANVAS_WIDTH;
          tempCanvas.height = CANVAS_HEIGHT;
          const ctx = tempCanvas.getContext('2d');
          
          if (ctx) {
            // Draw ONLY the current layer onto temp canvas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            ctx.save();
            const centerX = layer.x + layer.width / 2;
            const centerY = layer.y + layer.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((layer.rotation || 0) * Math.PI / 180);
            ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
            ctx.drawImage(layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
            ctx.restore();
            
            const layerPaths = processCanvas(tempCanvas);
            allPaths = [...allPaths, ...layerPaths];
            
            layerPaths.forEach(p => totalLen += p.points.length);
          }
      }

      setPaths(allPaths);
      setTotalPathLength(totalLen);
      setIsProcessing(false);
    };

    const timeoutId = setTimeout(processLayers, 100);
    return () => clearTimeout(timeoutId);

  }, [layers, settings.edgeSensitivity, settings.strokeSmoothness]);


  // -------------------------------------------------------------------------
  // 3. Main Draw Function
  // -------------------------------------------------------------------------
  const draw = (ctx: CanvasRenderingContext2D, currentProgress: number, targetWidth: number, targetHeight: number) => {
    // Fill Background
    ctx.fillStyle = settings.paperColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (isProcessing) {
       ctx.fillStyle = '#94a3b8';
       ctx.font = '14px sans-serif';
       ctx.fillText('Processing scene...', 20, 30);
       return;
    }
    
    // --- Phase 0: Camera Transition (Negative Progress) ---
    if (currentProgress < 0 && transition?.type === 'pan') {
       // Normalized time t from 0 to 1 during the transition
       // progress goes from -1 to 0
       const t = 1.0 + currentProgress; // 0 start, 1 end
       // Ease out cubic
       const ease = 1 - Math.pow(1 - t, 3);
       
       const w = targetWidth;
       const h = targetHeight;
       
       let offsetX = 0;
       let offsetY = 0;
       
       switch(transition.direction) {
           case 'right': offsetX = w; break;
           case 'left': offsetX = -w; break;
           case 'up': offsetY = -h; break;
           case 'down': offsetY = h; break;
           default: offsetX = w; break;
       }
       
       // Draw Previous Canvas moving OUT
       if (prevCompositeCanvas) {
           ctx.save();
           // Move from (0,0) to (-offsetX, -offsetY)
           ctx.translate(-offsetX * ease, -offsetY * ease);
           ctx.drawImage(prevCompositeCanvas, 0, 0, w, h);
           ctx.restore();
       } else {
           // Fallback if no prev canvas (e.g. restart), just plain background
           ctx.fillStyle = settings.paperColor;
           ctx.fillRect(0, 0, w, h);
       }
       
       // Draw Current Canvas moving IN (Empty, just paper)
       ctx.save();
       // Move from (offsetX, offsetY) to (0,0)
       ctx.translate(offsetX * (1 - ease), offsetY * (1 - ease));
       ctx.fillStyle = settings.paperColor;
       ctx.fillRect(0, 0, w, h);
       // We can optionally draw faint outlines or just blank paper
       ctx.restore();
       
       return; // Stop drawing rest
    }
    
    // We need compositeCanvas for color phase, but paths are sufficient for sketch
    if (paths.length === 0) return;

    const scaleX = targetWidth / CANVAS_WIDTH;
    const w = targetWidth; 
    const h = targetHeight;

    // Phase 1: Sketch (0% - 100%)
    const sketchProgress = Math.min(Math.max(currentProgress, 0), 1.0);
    
    // Phase 2: Color Sweep (Starts at 110% aka 1.1, ends at 200% aka 2.0)
    // We normalize this range (1.1 - 2.0) to (0.0 - 1.0)
    const colorProgress = Math.max((currentProgress - 1.1) / 0.9, 0);

    // --- Phase 1: Draw Sketch ---
    // Only draw paths if we are in phase 1 or they are the underlying base for phase 2
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;

    let baseColor = '#3f3f46';
    let baseWidth = settings.brushThickness * scaleX;

    switch (settings.lineStyle) {
      case 'marker':
        baseColor = '#000000';
        baseWidth *= 2; 
        ctx.globalAlpha = 0.95; 
        break;
      case 'pen':
        baseColor = '#09090b';
        baseWidth *= 0.8;
        ctx.globalAlpha = 1;
        break;
      case 'pencil':
      default:
        baseColor = '#3f3f46';
        ctx.globalAlpha = 0.85; 
        break;
    }
    ctx.strokeStyle = baseColor;

    // Always draw the full sketch if we are in Phase 2
    const pointsToDraw = currentProgress >= 1.0 
       ? totalPathLength 
       : Math.floor(totalPathLength * sketchProgress);
       
    let handPos: Point | null = null;
    let handAngle = 0;
    let drawnCount = 0;

    
    // Iterate through paths and draw segments
    for (const pathObj of paths) {
      if (drawnCount >= pointsToDraw) break;

      const path = pathObj.points;
      const remaining = pointsToDraw - drawnCount;
      const pathLen = path.length;
      
      const drawLen = Math.min(remaining, pathLen);
      
      if (drawLen > 0) {
        ctx.beginPath();
        // Dynamically adjust line width based on image intensity (strength)
        ctx.lineWidth = baseWidth * pathObj.strength;

        ctx.moveTo(path[0].x * w, path[0].y * h);
        
        for (let i = 1; i < drawLen; i++) {
           ctx.lineTo(path[i].x * w, path[i].y * h);
        }
        ctx.stroke();
        
        // Calculate hand position and angle for sketch phase
        if (drawLen > 0 && currentProgress < 1.0) {
            const lastP = path[drawLen - 1];
            handPos = { 
                x: lastP.x * w, 
                y: lastP.y * h 
            };
            
            // Calculate angle for realistic hand
            if (drawLen > 1) {
                const prevP = path[drawLen - 2];
                const dx = (lastP.x - prevP.x) * w;
                const dy = (lastP.y - prevP.y) * h;
                handAngle = Math.atan2(dy, dx);
            }
        }
      }
      
      drawnCount += drawLen;
    }

    // --- Phase 2: Sweep Color ---
    if (colorProgress > 0 && compositeCanvas) {
      ctx.save();
      // Implement sweep effect by clipping the composite image
      // Sweep moves from top to bottom like a brush
      const sweepHeight = h * colorProgress;
      
      ctx.beginPath();
      ctx.rect(0, 0, w, sweepHeight);
      ctx.clip();
      
      ctx.drawImage(compositeCanvas, 0, 0, w, h);
      ctx.restore();
      
      // Hand movement for coloring phase (Zig-Zag sweep)
      const sweepY = colorProgress; 
      const zigZagFrequency = 4; // Faster zig zag for brushing
      
      const xOscillation = Math.sin(sweepY * Math.PI * zigZagFrequency * 4); 
      const sweepX = 0.5 + (xOscillation * 0.45);

      handPos = {
         x: sweepX * w,
         y: sweepY * h
      };
      
      // Angle logic for sweep
      // Tilts back and forth as it sweeps
      handAngle = Math.cos(sweepY * Math.PI * zigZagFrequency * 4) * 0.3 + 0.5;
      
    } else if (currentProgress >= 1.0 && currentProgress < 1.1) {
       // Pause phase: Hide hand to indicate sketch done
       handPos = null;
    }

    // --- Draw Hand ---
    if (settings.showHand && currentProgress < 2.0 && handPos) {
      drawHand(ctx, handPos.x, handPos.y, handAngle, currentProgress >= 1.0);
    }
  };
  
  const drawHand = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, isColoring: boolean) => {
      ctx.save();
      
      if (settings.handStyle === 'realistic' && handImage) {
          // --- Realistic Image Hand ---
          ctx.translate(x, y);
          
          // Smooth rotation (dampen jerky path movements)
          let visualAngle = angle * 0.3; // Dampen the actual path angle
          if (isColoring) visualAngle = angle; // More movement when coloring

          ctx.rotate(visualAngle);
          
          const scale = 0.6; // Adjust scale for the image size
          ctx.scale(scale, scale);
          
          // Shadow for realism
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 10;
          ctx.shadowOffsetY = 15;

          // Offset image so pen tip (approximate) is at 0,0
          // For the specific Fluent Emoji, the tip is top-left-ish
          ctx.drawImage(handImage, -20, -20, 300, 300);

      } else {
          // --- Cartoon Procedural Hand ---
          
          // Determine tool colors
          let toolBodyColor = '#18181b'; 
          let toolTipColor = '#000';
          let toolWidth = 10;
          
          if (settings.lineStyle === 'pencil') {
            toolBodyColor = '#fbbf24'; 
            toolTipColor = '#52525b'; 
            toolWidth = 8;
          } else if (settings.lineStyle === 'marker') {
            toolBodyColor = '#e4e4e7'; 
            toolTipColor = '#000';
            toolWidth = 14;
          } else if (settings.lineStyle === 'pen') {
            toolBodyColor = '#2563eb'; 
            toolTipColor = '#09090b';
            toolWidth = 8;
          }

          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 8;
          ctx.shadowOffsetY = 8;
          
          // Hand skin
          ctx.fillStyle = '#fca5a5'; 
          ctx.beginPath();
          ctx.arc(x + 10, y + 20, 24, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowColor = 'transparent'; 
          ctx.strokeStyle = toolBodyColor;
          ctx.fillStyle = toolBodyColor;
          ctx.lineWidth = toolWidth;
          ctx.lineCap = 'round';
          
          // Tool Body
          ctx.beginPath();
          ctx.moveTo(x, y); 
          if (isColoring) {
              ctx.lineTo(x + 40, y + 40); 
          } else {
              ctx.lineTo(x + 35, y + 45); 
          }
          ctx.stroke();
          
          // Marker cap visual
          if (settings.lineStyle === 'marker') {
             ctx.fillStyle = '#000'; 
             ctx.beginPath();
             ctx.arc(x + 35, y + 45, toolWidth/2, 0, Math.PI * 2);
             ctx.fill();
          }

          // Tool Tip
          ctx.fillStyle = toolTipColor;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
      }

      ctx.restore();
  };

  useEffect(() => {
    if (!isProcessing && compositeCanvas && paths.length > 0) {
      onExportDataReady({
        // Scale 0-1 video progress to 0-2 internal canvas progress
        drawAtProgress: (ctx, p) => draw(ctx, p * 2.0, ctx.canvas.width, ctx.canvas.height),
        dimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
      });
    }
  }, [isProcessing, compositeCanvas, paths, settings, onExportDataReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 

    draw(ctx, progress, rect.width, rect.height);

  }, [progress, isProcessing, paths, settings, compositeCanvas, prevCompositeCanvas, handImage]);

  return (
    <div className={cn("relative overflow-hidden bg-white shadow-lg", className)} style={style}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block touch-none"
      />
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
           <div className="flex flex-col items-center gap-2">
             <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
             <span className="text-xs font-medium text-muted-foreground">Analysing scene...</span>
           </div>
        </div>
      )}
    </div>
  );
};