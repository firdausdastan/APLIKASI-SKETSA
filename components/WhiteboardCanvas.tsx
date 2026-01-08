
import React, { useRef, useEffect, useState, useImperativeHandle } from 'react';
import { AnimationSettings, CanvasExportData, MarkerPoint, SegmentTiming, ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT, CameraTransition, CameraState, TextElement } from '../types';
import { cn } from '../lib/utils';

// Helper types for geometry
type Point = { x: number; y: number };
// Updated Path to include stroke weight based on original image intensity
type Path = { 
    points: Point[]; 
    strength: number; 
};

interface ProcessedItem {
  id: string;
  type: 'image' | 'text';
  paths: Path[];
  colorCanvas: HTMLCanvasElement;
  // Bounds for checking hand position or optimizing draws
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WhiteboardCanvasProps {
  layers: ImageLayer[];
  textElements?: TextElement[];
  previousLayers?: ImageLayer[]; // Layers for the previous frame (for transitions)
  transition?: CameraTransition;
  camera: CameraState;
  isPlaying: boolean;
  progress: number;
  speed: number;
  settings: AnimationSettings;
  customMarkers?: MarkerPoint[];
  segmentTimings?: SegmentTiming[];
  onProgressChange: (p: number) => void;
  onComplete: () => void;
  onExportDataReady: (data: CanvasExportData) => void;
  onHandMove?: (x: number | null, y: number | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

// 3D Fluency Style Hand for "Realistic" Mode
const REALISTIC_HAND_URL = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Writing%20Hand.png";

const WhiteboardCanvasComponent = React.forwardRef<HTMLCanvasElement, WhiteboardCanvasProps>(({
  layers,
  textElements = [],
  previousLayers = [],
  transition,
  camera,
  progress,
  settings,
  onExportDataReady,
  onHandMove,
  className,
  style,
}, ref) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  // Expose the internal ref to the parent via the forwarded ref
  useImperativeHandle(ref, () => internalCanvasRef.current!);

  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Composite canvas for previous frame (transition)
  const [prevCompositeCanvas, setPrevCompositeCanvas] = useState<HTMLCanvasElement | null>(null);
  // Cached Static Background (Texture)
  const [staticBackground, setStaticBackground] = useState<HTMLCanvasElement | null>(null);
  
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
  // Helper to render a composite canvas for a single layer or text
  // -------------------------------------------------------------------------
  const renderItemCanvas = (layer?: ImageLayer, text?: TextElement, scaleFactor: number = 1.0): HTMLCanvasElement | null => {
     if (!layer && !text) return null;
     const canvas = document.createElement('canvas');
     // Scale canvas dimensions
     canvas.width = CANVAS_WIDTH * scaleFactor;
     canvas.height = CANVAS_HEIGHT * scaleFactor;
     
     // Optimize for frequent reads (Critical for Playback responsiveness)
     const ctx = canvas.getContext('2d', { willReadFrequently: true });
     if (!ctx) return null;

     // Transparent background for individual items
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     
     // Scale context to match the requested resolution
     ctx.scale(scaleFactor, scaleFactor);
     
     if (layer) {
       try {
         ctx.save();
         const centerX = layer.x + layer.width / 2;
         const centerY = layer.y + layer.height / 2;
         ctx.translate(centerX, centerY);
         ctx.rotate((layer.rotation || 0) * Math.PI / 180);
         ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
         // Apply layer opacity
         ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
         ctx.drawImage(layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
         ctx.restore();
       } catch (e) {
         console.error("Failed to draw layer", e);
       }
     }

     if (text) {
        ctx.save();
        ctx.textBaseline = 'top';
        ctx.font = `${text.bold ? 'bold ' : ''}${text.italic ? 'italic ' : ''}${text.fontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        ctx.textAlign = text.align;
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
     }

     return canvas;
  };

  // Helper for previous frame transition composite
  useEffect(() => {
     if (previousLayers.length === 0) {
         setPrevCompositeCanvas(null);
         return;
     }
     const canvas = document.createElement('canvas');
     canvas.width = CANVAS_WIDTH;
     canvas.height = CANVAS_HEIGHT;
     const ctx = canvas.getContext('2d');
     if (ctx) {
         ctx.fillStyle = '#ffffff';
         ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
         previousLayers.forEach(layer => {
            ctx.save();
            const centerX = layer.x + layer.width / 2;
            const centerY = layer.y + layer.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((layer.rotation || 0) * Math.PI / 180);
            ctx.scale(layer.scaleX || 1, layer.scaleY || 1);
            ctx.drawImage(layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
            ctx.restore();
         });
         setPrevCompositeCanvas(canvas);
     }
  }, [previousLayers]);

  // -------------------------------------------------------------------------
  // 2. Sequential Processing (Sketch Generation)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (layers.length === 0 && textElements.length === 0) {
        setProcessedItems([]);
        return;
    }

    const processItems = async () => {
      setIsProcessing(true);
      const newItems: ProcessedItem[] = [];

      // Smoothing function to reduce jitter from edge detection
      const smoothPath = (points: Point[]): Point[] => {
         if (points.length < 3) return points;
         const smoothed: Point[] = [];
         for(let i = 0; i < points.length; i++) {
            let sumX = 0, sumY = 0, count = 0;
            for(let j = -2; j <= 2; j++) {
                if(i + j >= 0 && i + j < points.length) {
                    sumX += points[i+j].x;
                    sumY += points[i+j].y;
                    count++;
                }
            }
            smoothed.push({ x: sumX / count, y: sumY / count });
         }
         return smoothed;
      };

      const generatePaths = (canvas: HTMLCanvasElement): Path[] => {
          const w = canvas.width;
          const h = canvas.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return [];

          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          
          const gray = new Uint8Array(w * h);
          for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] < 10) {
                gray[i / 4] = 255; 
            } else {
                gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }
          }

          const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
          const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
          const magnitudes = new Float32Array(w * h);
          
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              let pixelX = 0, pixelY = 0, k = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const val = gray[(y + ky) * w + (x + kx)];
                  pixelX += val * kernelX[k];
                  pixelY += val * kernelY[k];
                  k++;
                }
              }
              magnitudes[y * w + x] = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
            }
          }

          const edges = new Uint8Array(w * h);
          const threshold = 120 - (settings.edgeSensitivity * 100); 

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
               if (magnitudes[y * w + x] < threshold) continue;
               edges[y * w + x] = 1; 
            }
          }

          const visited = new Uint8Array(w * h);
          const paths: Path[] = [];
          const neighbors = [{dx:1, dy:0}, {dx:1, dy:1}, {dx:0, dy:1}, {dx:-1, dy:1}, {dx:-1, dy:0}, {dx:-1, dy:-1}, {dx:0, dy:-1}, {dx:1, dy:-1}];

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = y * w + x;
              if (edges[idx] && !visited[idx]) {
                const currentPath: Point[] = [];
                let currX = x, currY = y;
                let tracing = true;
                while (tracing) {
                   visited[currY * w + currX] = 1;
                   currentPath.push({ x: currX / w, y: currY / h }); 
                   tracing = false;
                   for (const {dx, dy} of neighbors) {
                     const nx = currX + dx, ny = currY + dy;
                     if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) {
                       if (edges[ny * w + nx] && !visited[ny * w + nx]) {
                         currX = nx; currY = ny; tracing = true; break; 
                       }
                     }
                   }
                }
                if (currentPath.length > 5) { 
                  paths.push({ points: smoothPath(smoothPath(currentPath)), strength: 1.0 });
                }
              }
            }
          }
          return paths;
      };

      const sortPathsSmart = (pathsToSort: Path[]): Path[] => {
          if (pathsToSort.length === 0) return [];
          const getBounds = (p: Path) => {
             let minX = 1, minY = 1, maxX = 0, maxY = 0;
             for (const pt of p.points) {
                 minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
                 maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
             }
             return { cx: (minX + maxX)/2, cy: (minY + maxY)/2, minX, minY, maxX, maxY };
          };

          const meta = pathsToSort.map((p, i) => ({ ...getBounds(p), path: p, index: i }));
          const clusters: { center: Point, paths: typeof meta }[] = [];
          const visited = new Set<number>();
          const CLUSTER_THRESHOLD = 0.05; 

          for (let i = 0; i < meta.length; i++) {
              if (visited.has(i)) continue;
              const cluster = [meta[i]];
              visited.add(i);
              const queue = [meta[i]];
              while (queue.length > 0) {
                  const current = queue.shift()!;
                  for (let j = 0; j < meta.length; j++) {
                      if (visited.has(j)) continue;
                      const o = meta[j];
                      if (!(current.maxX + CLUSTER_THRESHOLD < o.minX || current.minX - CLUSTER_THRESHOLD > o.maxX || current.maxY + CLUSTER_THRESHOLD < o.minY || current.minY - CLUSTER_THRESHOLD > o.maxY)) {
                          visited.add(j); cluster.push(o); queue.push(o);
                      }
                  }
              }
              clusters.push({ center: { x: cluster.reduce((s, it)=>s+it.cx,0)/cluster.length, y: cluster.reduce((s, it)=>s+it.cy,0)/cluster.length }, paths: cluster });
          }
          clusters.sort((a, b) => (a.center.y * 5 + a.center.x) - (b.center.y * 5 + b.center.x));
          const finalSorted: Path[] = [];
          for (const c of clusters) {
              c.paths.sort((a, b) => a.minY - b.minY);
              const remaining = [...c.paths];
              let curr = remaining.shift()!;
              finalSorted.push(curr.path);
              while (remaining.length > 0) {
                  const end = curr.path.points[curr.path.points.length-1];
                  let bIdx = -1, bDist = Infinity;
                  for (let i = 0; i < remaining.length; i++) {
                      const s = remaining[i].path.points[0];
                      const d = Math.pow(s.x-end.x, 2) + Math.pow(s.y-end.y, 2);
                      if (d < bDist) { bDist = d; bIdx = i; }
                  }
                  curr = remaining.splice(bIdx !== -1 ? bIdx : 0, 1)[0];
                  finalSorted.push(curr.path);
              }
          }
          return finalSorted;
      };

      const ANALYSIS_SCALE = 0.5; 
      for (const layer of layers) {
         const analysis = renderItemCanvas(layer, undefined, ANALYSIS_SCALE);
         const display = renderItemCanvas(layer, undefined, 1.0);
         if (analysis && display) {
             let paths = generatePaths(analysis);
             if (settings.drawingOrder === 'smart-flow') paths = sortPathsSmart(paths);
             else if (settings.drawingOrder !== 'random') paths.sort((a, b) => (a.points[0].y + a.points[0].x * 0.05) - (b.points[0].y + b.points[0].x * 0.05));
             newItems.push({ id: layer.id, type: 'image', paths, colorCanvas: display, x: layer.x, y: layer.y, width: layer.width, height: layer.height });
         }
      }
      for (const text of textElements) {
         const analysis = renderItemCanvas(undefined, text, ANALYSIS_SCALE);
         const display = renderItemCanvas(undefined, text, 1.0);
         if (analysis && display) {
             let paths = generatePaths(analysis);
             if (settings.drawingOrder === 'smart-flow') paths = sortPathsSmart(paths);
             newItems.push({ id: text.id, type: 'text', paths, colorCanvas: display, x: text.x, y: text.y, width: text.fontSize * text.text.length, height: text.fontSize });
         }
      }
      setProcessedItems(newItems);
      setIsProcessing(false);
    };
    const timeoutId = setTimeout(processItems, 10);
    return () => clearTimeout(timeoutId);
  }, [layers, textElements, settings.edgeSensitivity, settings.strokeSmoothness, settings.drawingOrder]);

  // -------------------------------------------------------------------------
  // Procedural Paper Texture (Cached)
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Generate Static Background Canvas
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_WIDTH;
    bgCanvas.height = CANVAS_HEIGHT;
    const ctx = bgCanvas.getContext('2d');
    
    if (ctx) {
        const w = CANVAS_WIDTH;
        const h = CANVAS_HEIGHT;
        const intensity = settings.textureIntensity;

        // Base Color
        ctx.fillStyle = settings.paperColor;
        ctx.fillRect(0, 0, w, h);

        if (settings.paperTexture !== 'none' && intensity > 0) {
            // 1. Grain/Noise Effect
            if (settings.paperTexture === 'grainy' || settings.paperTexture === 'crumpled') {
                const grainCount = (w * h) / 100 * intensity;
                ctx.fillStyle = `rgba(0,0,0,${0.03 * intensity})`;
                for (let i = 0; i < grainCount; i++) {
                    const x = Math.random() * w;
                    const y = Math.random() * h;
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            // 2. Crumpled / Lecek Effect
            if (settings.paperTexture === 'crumpled') {
                ctx.strokeStyle = `rgba(0,0,0,${0.06 * intensity})`;
                ctx.lineWidth = 1;
                const foldCount = 8 + Math.floor(intensity * 12);
                
                for (let i = 0; i < foldCount; i++) {
                    ctx.beginPath();
                    const startX = Math.random() * w;
                    const startY = Math.random() * h;
                    ctx.moveTo(startX, startY);
                    
                    let cx = startX, cy = startY;
                    const segments = 5 + Math.floor(Math.random() * 5);
                    for(let j = 0; j < segments; j++) {
                    cx += (Math.random() - 0.5) * 400;
                    cy += (Math.random() - 0.5) * 400;
                    ctx.lineTo(cx, cy);
                    }
                    ctx.stroke();

                    // Shading for the fold
                    const gradient = ctx.createLinearGradient(startX, startY, cx, cy);
                    gradient.addColorStop(0, `rgba(255,255,255,${0.05 * intensity})`);
                    gradient.addColorStop(0.5, `rgba(0,0,0,${0.03 * intensity})`);
                    gradient.addColorStop(1, 'transparent');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }

                // Vignette
                const vignette = ctx.createRadialGradient(w/2, h/2, w/4, w/2, h/2, w/1.2);
                vignette.addColorStop(0, 'transparent');
                vignette.addColorStop(1, `rgba(0,0,0,${0.1 * intensity})`);
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, w, h);
            }
        }
    }
    setStaticBackground(bgCanvas);
  }, [settings.paperColor, settings.paperTexture, settings.textureIntensity]);

  const drawHand = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, isColoring: boolean) => {
    if (!handImage) return;

    ctx.save();
    ctx.translate(x, y);

    const scale = settings.handStyle === 'cartoon' ? 0.7 : 0.7;
    ctx.scale(scale, scale);

    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 10;

    // Offset to align pen tip to (0,0)
    const size = 450;
    const offsetX = -60;  
    const offsetY = -360; 

    ctx.drawImage(handImage, offsetX, offsetY, size, size);
    ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D, currentProgress: number, targetWidth: number, targetHeight: number) => {
    // Draw cached background if available, otherwise fallback fill
    if (staticBackground) {
        ctx.drawImage(staticBackground, 0, 0, targetWidth, targetHeight);
    } else {
        ctx.fillStyle = settings.paperColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    if (isProcessing) {
       ctx.fillStyle = '#94a3b8'; ctx.font = '20px sans-serif';
       ctx.fillText('Processing scene...', 40, 50);
       return;
    }
    
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    
    // TRANSITION RENDER LOGIC
    if (currentProgress < 0 && transition && transition.type !== 'cut') {
       const t = 1.0 + currentProgress; // t goes from 0 to 1 during transition
       const w = CANVAS_WIDTH, h = CANVAS_HEIGHT;
       
       // Easing function for smooth movement
       const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

       // 1. PAN TRANSITION
       if (transition.type === 'pan') {
           let tx = 0, ty = 0;
           switch(transition.direction) {
               case 'right': tx = w; break; case 'left': tx = -w; break;
               case 'up': ty = -h; break; case 'down': ty = h; break;
               default: tx = w;
           }
           
           if (prevCompositeCanvas) {
               ctx.save(); 
               ctx.translate(-tx * ease, -ty * ease);
               ctx.drawImage(prevCompositeCanvas, 0, 0, w, h); 
               ctx.restore();
           }
           
           ctx.save(); 
           ctx.translate(tx * (1 - ease), ty * (1 - ease));
           if (staticBackground) {
               ctx.drawImage(staticBackground, 0, 0, w, h);
           } else {
               ctx.fillStyle = settings.paperColor; ctx.fillRect(0, 0, w, h);
           }
           ctx.restore();
       }
       
       // 2. FADE (CROSS DISSOLVE) TRANSITION
       else if (transition.type === 'fade') {
           if (prevCompositeCanvas) {
               ctx.save();
               ctx.globalAlpha = 1.0 - t; // Fade out previous
               ctx.drawImage(prevCompositeCanvas, 0, 0, w, h);
               ctx.restore();
           }
           
           ctx.save();
           ctx.globalAlpha = t; // Fade in current background
           if (staticBackground) {
               ctx.drawImage(staticBackground, 0, 0, w, h);
           } else {
               ctx.fillStyle = settings.paperColor; ctx.fillRect(0, 0, w, h);
           }
           ctx.restore();
       }

       // 3. ZOOM (SCALE) TRANSITION
       else if (transition.type === 'zoom') {
           if (prevCompositeCanvas) {
               ctx.save();
               // Previous slide zooms in slightly and fades out
               const scaleOut = 1.0 + (t * 0.2); 
               ctx.translate(w/2, h/2);
               ctx.scale(scaleOut, scaleOut);
               ctx.translate(-w/2, -h/2);
               ctx.globalAlpha = 1.0 - ease;
               ctx.drawImage(prevCompositeCanvas, 0, 0, w, h);
               ctx.restore();
           }

           ctx.save();
           // New slide zooms in from 0.8 to 1.0 and fades in
           const scaleIn = 0.8 + (ease * 0.2);
           ctx.translate(w/2, h/2);
           ctx.scale(scaleIn, scaleIn);
           ctx.translate(-w/2, -h/2);
           ctx.globalAlpha = ease;
           if (staticBackground) {
               ctx.drawImage(staticBackground, 0, 0, w, h);
           } else {
               ctx.fillStyle = settings.paperColor; ctx.fillRect(0, 0, w, h);
           }
           ctx.restore();
       }

       // 4. PAPER SLIDE (New Sheet slides over old)
       else if (transition.type === 'paper-slide') {
           // Draw previous slide (Stationary at back)
           if (prevCompositeCanvas) {
               ctx.save();
               ctx.drawImage(prevCompositeCanvas, 0, 0, w, h);
               ctx.restore();
           } else {
               ctx.fillStyle = '#ffffff';
               ctx.fillRect(0,0,w,h);
           }

           // Calculate incoming slide position
           let tx = 0, ty = 0;
           // t goes 0 -> 1. 
           const offset = 1.0 - ease; // 1.0 down to 0.0
           
           switch(transition.direction) {
                case 'left': tx = -w * offset; break; 
                case 'right': tx = w * offset; break; 
                case 'up': ty = -h * offset; break; 
                case 'down': ty = h * offset; break;
                default: tx = w * offset;
           }

           ctx.save();
           ctx.translate(tx, ty);
           
           // Drop Shadow
           ctx.shadowColor = 'rgba(0,0,0,0.3)';
           ctx.shadowBlur = 50;
           ctx.shadowOffsetX = (tx > 0) ? -15 : 15;
           ctx.shadowOffsetY = (ty > 0) ? -15 : 15;

           // Draw New Paper
           if (staticBackground) {
               ctx.drawImage(staticBackground, 0, 0, w, h);
           } else {
               ctx.fillStyle = settings.paperColor;
               ctx.fillRect(0, 0, w, h);
           }
           ctx.restore();
       }

       ctx.restore(); // Restore camera state
       if (onHandMove) onHandMove(null, null);
       return; 
    }
    
    if (processedItems.length === 0) { ctx.restore(); if (onHandMove) onHandMove(null, null); return; }

    const w = CANVAS_WIDTH, h = CANVAS_HEIGHT;
    const timePerItem = 2.0 / processedItems.length;
    let activeHandPos: Point | null = null, activeHandAngle = 0, isActivePhaseColoring = false;

    processedItems.forEach((item, index) => {
        const itemStart = index * timePerItem, itemEnd = (index + 1) * timePerItem;
        if (currentProgress >= itemEnd) { ctx.drawImage(item.colorCanvas, 0, 0, w, h); return; }
        if (currentProgress < itemStart) return;

        const localProgress = ((currentProgress - itemStart) / timePerItem) * 2.0;
        const sketchProgress = Math.min(Math.max(localProgress, 0), 1.0);
        const colorProgress = Math.max((localProgress - 1.1) / 0.9, 0);
        
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        let baseColor = '#3f3f46', baseWidth = settings.brushThickness;
        if (settings.lineStyle === 'marker') { baseColor = '#000'; baseWidth *= 2; }
        else if (settings.lineStyle === 'pen') { baseColor = '#09090b'; baseWidth *= 8 * 0.8; } // Fixed scaling issue
        else { baseWidth = settings.brushThickness; } // Pencil
        
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = baseWidth; 

        let totalLen = 0; item.paths.forEach(p => totalLen += p.points.length);
        const pointsToDrawFloat = totalLen * sketchProgress;
        let drawnCount = 0;
        
        for (const pathObj of item.paths) {
            const pLen = pathObj.points.length;
            if (localProgress < 1.0 && activeHandPos === null && pointsToDrawFloat >= drawnCount && pointsToDrawFloat < drawnCount + pLen) {
                const lFI = pointsToDrawFloat - drawnCount, idxA = Math.floor(lFI), idxB = Math.min(idxA+1, pLen-1), t = lFI-idxA;
                const pA = pathObj.points[idxA], pB = pathObj.points[idxB];
                activeHandPos = { x: (pA.x+(pB.x-pA.x)*t)*w, y: (pA.y+(pB.y-pA.y)*t)*h };
                const pBase = pathObj.points[Math.max(0, idxA-2)], pTarget = pathObj.points[Math.min(pLen-1, idxA+4)];
                activeHandAngle = Math.atan2((pTarget.y-pBase.y)*h, (pTarget.x-pBase.x)*w);
            }
            if (drawnCount >= Math.floor(pointsToDrawFloat)) break;
            const drawLen = Math.min(Math.floor(pointsToDrawFloat)-drawnCount, pathObj.points.length);
            if (drawLen > 0) {
                ctx.beginPath(); ctx.moveTo(pathObj.points[0].x*w, pathObj.points[0].y*h);
                for (let i = 1; i < drawLen; i++) ctx.lineTo(pathObj.points[i].x*w, pathObj.points[i].y*h);
                ctx.stroke();
            }
            drawnCount += pathObj.points.length;
        }
        
        if (localProgress >= 1.0 && colorProgress === 0) {
            item.paths.forEach(pObj => {
                ctx.beginPath(); ctx.moveTo(pObj.points[0].x*w, pObj.points[0].y*h);
                for (let k = 1; k < pObj.points.length; k++) ctx.lineTo(pObj.points[k].x*w, pObj.points[k].y*h);
                ctx.stroke();
            });
        }

        if (colorProgress > 0) {
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h * colorProgress); ctx.clip();
            ctx.drawImage(item.colorCanvas, 0, 0, w, h); ctx.restore();
            const sweepY = colorProgress, phase = sweepY * Math.PI * 32;
            const sweepX = 0.5 + Math.sin(phase) * 0.4;
            activeHandPos = { x: sweepX * w, y: sweepY * h };
            activeHandAngle = 0.6 + Math.cos(phase) * 0.4;
            isActivePhaseColoring = true;
        }
    });

    if (settings.showHand && activeHandPos) {
      drawHand(ctx, activeHandPos.x, activeHandPos.y, activeHandAngle, isActivePhaseColoring);
      if (onHandMove) onHandMove(activeHandPos.x, activeHandPos.y);
    } else { if (onHandMove) onHandMove(null, null); }
    ctx.restore();
  };

  useEffect(() => {
    const canvas = internalCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    // FORCE RESOLUTION: Ensure canvas is always 1920x1080 (16:9)
    if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }
    
    // Reset transform to identity since canvas pixels are 1:1 with logical coordinates
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    
    draw(ctx, progress, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [progress, isProcessing, processedItems, settings, prevCompositeCanvas, handImage, camera, staticBackground]);

  return (
    <div className="relative overflow-hidden bg-white shadow-lg" style={style}>
      <canvas ref={internalCanvasRef} className="w-full h-full block touch-none" />
    </div>
  );
});

export const WhiteboardCanvas = React.memo(WhiteboardCanvasComponent);
