
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { ImageUploader } from './components/ImageUploader';
import { SettingsPanel } from './components/SettingsPanel';
import { ExportDialog } from './components/ExportDialog';
import { SequenceMarker } from './components/SequenceMarker';
import { SegmentTimeline } from './components/SegmentTimeline';
import { TextOverlay, TextEditorPanel } from './components/TextOverlay';
import { AudioManager } from './components/AudioManager';
import { TimelineTrack } from './components/TimelineTrack';
import { ImageLayerOverlay } from './components/ImageLayerOverlay';
import { AnimationSettings, CanvasExportData, MarkerPoint, SegmentTiming, TimelineImage, AudioTrack, TextElement as TextType, ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT, CameraTransition, CameraState, LayerFraming } from './types';
import { 
  Image as ImageIcon, 
  Type, 
  Music, 
  Mic, 
  Play, 
  Pause,
  RotateCcw,
  RotateCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  X,
  PlusSquare,
  Layers,
  ArrowLeftRight,
  ArrowUpDown,
  Camera,
  MoveRight,
  MonitorPlay,
  Shapes,
  Hand,
  MousePointer2,
  Sparkles,
  Loader2,
  Target,
  Scan,
  Video,
  Zap,
  Eraser,
  Search,
  Globe,
  Download,
  Plus,
  FileCode,
  FlipHorizontal,
  FlipVertical,
  Minimize2,
  Maximize2,
  Upload,
  MoveUp,
  MoveDown,
  Trash2,
  StickyNote,
  History,
  Clock,
  RotateCcw as RestoreIcon
} from 'lucide-react';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';

// Updated API Key
const FREEPIK_API_KEY = "FPSXaf57f9ad96ef83255c8517de23493e4a";

const defaultSettings: AnimationSettings = {
  brushThickness: 2,
  paperColor: '#fcf5e5', // Start with Parchment
  paperTexture: 'grainy',
  textureIntensity: 0.3,
  showHand: true,
  handStyle: 'realistic',
  strokeSmoothness: 0.5,
  drawingOrder: 'top-to-bottom',
  edgeSensitivity: 0.5,
  lineStyle: 'pencil',
  autoCamera: true, 
};

const defaultTransition: CameraTransition = {
  type: 'cut',
  direction: 'right',
  duration: 1.0
};

const defaultCamera: CameraState = {
  x: 0, y: 0, zoom: 1
};

const SVG_ASSETS = [
  { name: "Arrow Right", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>` },
  { name: "Circle", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>` },
  { name: "Square", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>` },
  { name: "Star", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` },
  { name: "Heart", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` },
  { name: "Idea", src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>` }
];

const MAX_PROGRESS = 2.0;
const PAUSE_DURATION = 2.0; // 2 seconds delay after animation

interface HistoryState {
    id: string;
    timestamp: number;
    timelineData: any;
    textData: TextType[];
    thumb?: string;
}

const App = () => {
  const [timelineImages, setTimelineImages] = useState<TimelineImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [settings, setSettings] = useState<AnimationSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<'shapes' | 'freepik' | 'ai' | 'svg' | 'audio'>('shapes');
  const [exportData, setExportData] = useState<CanvasExportData | null>(null);
  const [freepikQuery, setFreepikQuery] = useState('');
  const [freepikImages, setFreepikImages] = useState<any[]>([]);
  const [loadingFreepik, setLoadingFreepik] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [svgUrl, setSvgUrl] = useState('');
  const [isConvertingSvg, setIsConvertingSvg] = useState(false);
  const [tool, setTool] = useState<'select' | 'hand'>('select');
  const [camera, setCamera] = useState<CameraState>(defaultCamera);
  const [cameraTarget, setCameraTarget] = useState<{x: number, y: number, zoom: number} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [currentLayers, setCurrentLayers] = useState<ImageLayer[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [textElements, setTextElements] = useState<TextType[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  
  // History State
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);

  // Project I/O
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Direct reference to canvas
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const currentHandPosRef = useRef<{x: number, y: number} | null>(null);
  const smoothedTargetRef = useRef<{x: number, y: number, zoom: number} | null>(null);

  // Calculate global time for audio sync
  const globalTime = useMemo(() => {
    if (timelineImages.length === 0) return 0;
    let t = 0;
    for (let i = 0; i < currentImageIndex; i++) {
        t += timelineImages[i].duration;
    }
    const currentDur = timelineImages[currentImageIndex]?.duration || 0;
    
    // Clamp progress to MAX_PROGRESS (2.0) so audio time doesn't drift during the pause
    const clampedProgress = Math.min(progress, MAX_PROGRESS);
    
    // MAX_PROGRESS (2.0) = Full duration
    t += (clampedProgress / MAX_PROGRESS) * currentDur;
    return Math.max(0, t);
  }, [timelineImages, currentImageIndex, progress]);

  // --- SERIALIZATION HELPERS ---
  
  // Helper to serialize Timeline (remove HTMLImageElement)
  const serializeTimeline = useCallback((timeline: TimelineImage[]) => {
      return timeline.map(frame => ({
          ...frame,
          layers: frame.layers.map(layer => ({
              ...layer,
              imageSrc: layer.image.src, // Save Source
              image: undefined // Remove DOM Object
          }))
      }));
  }, []);

  // Helper to deserialize Timeline (restore HTMLImageElement)
  const deserializeTimeline = useCallback(async (data: any[]) => {
      const restored = await Promise.all(data.map(async (frame) => {
          const newLayers = await Promise.all(frame.layers.map(async (layer: any) => {
              const img = new Image();
              img.crossOrigin = "Anonymous";
              img.src = layer.imageSrc;
              await new Promise((resolve) => { 
                  img.onload = resolve; 
                  img.onerror = resolve; // Continue even if fail
              });
              return {
                  ...layer,
                  image: img,
                  imageSrc: undefined
              };
          }));
          return { ...frame, layers: newLayers };
      }));
      return restored;
  }, []);

  // --- PROJECT SAVE / LOAD ---

  const handleSaveProject = useCallback(() => {
      const projectData = {
          version: 1,
          timestamp: Date.now(),
          timeline: serializeTimeline(timelineImages),
          textElements,
          audioTracks,
          settings,
          speed
      };
      
      const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sketch-project-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Project saved successfully");
  }, [timelineImages, textElements, audioTracks, settings, speed, serializeTimeline]);

  const handleLoadProject = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const content = ev.target?.result as string;
              const data = JSON.parse(content);
              
              if (!data.timeline) throw new Error("Invalid project file");

              const toastId = toast.loading("Loading project...");
              
              const restoredTimeline = await deserializeTimeline(data.timeline);
              setTimelineImages(restoredTimeline);
              setTextElements(data.textElements || []);
              setAudioTracks(data.audioTracks || []);
              if (data.settings) setSettings(data.settings);
              if (data.speed) setSpeed(data.speed);
              
              // Reset state
              setCurrentImageIndex(0);
              setProgress(0);
              setIsPlaying(false);
              
              toast.dismiss(toastId);
              toast.success("Project loaded successfully");
          } catch (err) {
              console.error(err);
              toast.error("Failed to load project file");
          }
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = ''; 
  }, [deserializeTimeline]);

  // --- HISTORY SYSTEM ---

  // Auto-Snapshot Effect
  useEffect(() => {
    if (timelineImages.length === 0 && textElements.length === 0) return;
    if (isRestoringRef.current) return;

    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);

    historyTimeoutRef.current = setTimeout(() => {
        const snapshot: HistoryState = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            timelineData: serializeTimeline(timelineImages),
            textData: JSON.parse(JSON.stringify(textElements)), // Deep copy text
            thumb: timelineImages[0]?.layers[0]?.image.src
        };

        setHistory(prev => {
            // Keep last 15 states
            const newHistory = [snapshot, ...prev].slice(0, 15);
            return newHistory;
        });
    }, 2000); // Debounce 2s

    return () => {
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    };
  }, [timelineImages, textElements, serializeTimeline]);

  const handleRestore = async (snapshot: HistoryState) => {
      isRestoringRef.current = true;
      const toastId = toast.loading("Restoring version...");
      try {
          const restoredTimeline = await deserializeTimeline(snapshot.timelineData);
          setTimelineImages(restoredTimeline);
          setTextElements(snapshot.textData);
          // Update current layers if needed
          if (restoredTimeline.length > 0) {
              const safeIndex = Math.min(currentImageIndex, restoredTimeline.length - 1);
              setCurrentLayers(restoredTimeline[safeIndex].layers);
              setCurrentImageIndex(safeIndex);
          } else {
              setCurrentLayers([]);
          }
          toast.dismiss(toastId);
          toast.success("Project version restored");
          setShowHistory(false);
      } catch (e) {
          toast.error("Failed to restore version");
          console.error(e);
      } finally {
          // Allow small delay before resuming tracking to avoid duplicate snapshot
          setTimeout(() => { isRestoringRef.current = false; }, 1000);
      }
  };

  useEffect(() => {
    if (timelineImages.length > 0 && currentImageIndex < timelineImages.length) {
      const frame = timelineImages[currentImageIndex];
      setCurrentLayers(frame.layers);
      if (!isPlaying) {
          setCamera(frame.camera || defaultCamera);
          smoothedTargetRef.current = null;
      }
    } else if (timelineImages.length === 0) {
      setCurrentLayers([]);
      setCamera(defaultCamera);
    }
  }, [currentImageIndex, timelineImages, isPlaying]); 

  const handleLayersUpdate = useCallback((newLayers: ImageLayer[]) => {
    setCurrentLayers(newLayers);
    setTimelineImages(prev => prev.map((img, idx) => 
      idx === currentImageIndex ? { ...img, layers: newLayers } : img
    ));
  }, [currentImageIndex]);

  const handleCameraUpdate = useCallback((newCamera: CameraState) => {
    setCamera(newCamera);
    setTimelineImages(prev => prev.map((img, idx) => 
        idx === currentImageIndex ? { ...img, camera: newCamera } : img
    ));
  }, [currentImageIndex]);

  const handleTransitionUpdate = useCallback((updates: Partial<CameraTransition>) => {
    setTimelineImages(prev => prev.map((img, idx) => 
      idx === currentImageIndex ? { ...img, transition: { ...img.transition, ...updates } } : img
    ));
  }, [currentImageIndex]);

  const handleHandMove = useCallback((x: number | null, y: number | null) => {
      if (x !== null && y !== null) {
          currentHandPosRef.current = { x, y };
      } else {
          currentHandPosRef.current = null;
      }
  }, []);

  const handleLayerSelect = useCallback((id: string | null) => {
    setSelectedLayerId(id);
  }, []);

  const handleRemoveBackground = useCallback(() => {
    if (!selectedLayerId) return;
    const layer = currentLayers.find(l => l.id === selectedLayerId);
    if (!layer) return;

    const img = layer.image;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const threshold = 230; 

    for(let i = 0; i < data.length; i += 4) {
      if (data[i] > threshold && data[i+1] > threshold && data[i+2] > threshold) {
         data[i+3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const newUrl = canvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
        const newLayers = currentLayers.map(l => l.id === selectedLayerId ? { ...l, image: newImg } : l);
        handleLayersUpdate(newLayers);
        toast.success("Background removed");
    };
    newImg.src = newUrl;
  }, [selectedLayerId, currentLayers, handleLayersUpdate]);

  const handleLayerReorder = useCallback((direction: 'up' | 'down') => {
      if (!selectedLayerId) return;
      const index = currentLayers.findIndex(l => l.id === selectedLayerId);
      if (index === -1) return;

      const newLayers = [...currentLayers];
      if (direction === 'up') {
          // Bring to Front (Move to end of array)
          const [removed] = newLayers.splice(index, 1);
          newLayers.push(removed);
      } else {
          // Send to Back (Move to start of array)
          const [removed] = newLayers.splice(index, 1);
          newLayers.unshift(removed);
      }
      handleLayersUpdate(newLayers);
  }, [currentLayers, selectedLayerId, handleLayersUpdate]);

  const handleAddFrame = useCallback(() => {
      setTimelineImages(prev => [
          ...prev, 
          { 
              id: `f-${Date.now()}`, 
              layers: [], 
              duration: 5, 
              order: prev.length + 1, 
              thumbnail: '', 
              transition: { ...defaultTransition }, 
              camera: { ...defaultCamera } 
          }
      ]);
      setCurrentImageIndex(prev => timelineImages.length); // Jump to new frame
      toast.success("New empty frame added");
  }, [timelineImages.length]);

  const getCanvasScaleFactor = () => {
     if (!canvasContainerRef.current) return 1;
     const rect = canvasContainerRef.current.getBoundingClientRect();
     return CANVAS_WIDTH / rect.width;
  };

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const newZoom = Math.min(Math.max(0.1, camera.zoom + delta), 5);
        
        if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const scaleFactor = getCanvasScaleFactor();
            const mouseX = (e.clientX - rect.left) * scaleFactor;
            const mouseY = (e.clientY - rect.top) * scaleFactor;
            const worldX = (mouseX - camera.x) / camera.zoom;
            const worldY = (mouseY - camera.y) / camera.zoom;
            const newX = mouseX - worldX * newZoom;
            const newY = mouseY - worldY * newZoom;
            handleCameraUpdate({ ...camera, zoom: newZoom, x: newX, y: newY });
        } else {
            handleCameraUpdate({ ...camera, zoom: newZoom });
        }
    } else {
        if (!e.ctrlKey) {
            const scaleFactor = getCanvasScaleFactor();
            handleCameraUpdate({ ...camera, x: camera.x - (e.deltaX * scaleFactor), y: camera.y - (e.deltaY * scaleFactor) });
        }
    }
  }, [camera, handleCameraUpdate]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (tool === 'hand' || e.button === 1) {
          setIsPanning(true);
          lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (isPanning) {
          const scaleFactor = getCanvasScaleFactor();
          const dx = (e.clientX - lastMousePos.current.x) * scaleFactor;
          const dy = (e.clientY - lastMousePos.current.y) * scaleFactor;
          handleCameraUpdate({ ...camera, x: camera.x + dx, y: camera.y + dy });
          lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleCanvasMouseUp = () => setIsPanning(false);

  const handleFreepikSearch = async () => {
    if (!freepikQuery.trim()) return;
    setLoadingFreepik(true);
    try {
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://api.freepik.com/v1/resources?locale=en-US&page=1&limit=20&term=${encodeURIComponent(freepikQuery)}`)}`, {
            headers: { 'X-Freepik-API-Key': FREEPIK_API_KEY, 'Accept': 'application/json' }
        });
        const data = await response.json();
        setFreepikImages(data.data || []);
    } catch (error) { toast.error("Freepik search failed"); }
    setLoadingFreepik(false);
  };

  const handleImportFreepik = (imageUrl: string) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => { addImagesToTimeline([img]); setShowAddMenu(false); toast.success("Asset added"); };
      img.onerror = () => {
          const proxyImg = new Image();
          proxyImg.crossOrigin = "Anonymous";
          proxyImg.onload = () => { addImagesToTimeline([proxyImg]); setShowAddMenu(false); };
          proxyImg.src = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=png`;
      }
      img.src = imageUrl;
  };

  const handleGenerateAi = async () => {
      if (!aiPrompt.trim()) return;
      setIsGeneratingAi(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response: GenerateContentResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `Vector style of ${aiPrompt}. Flat, white background.` }] },
              config: { imageConfig: { aspectRatio: "1:1" } }
          });
          
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                const img = new Image();
                img.src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                await new Promise((resolve) => { img.onload = resolve; });
                addImagesToTimeline([img]);
                setShowAddMenu(false);
                break;
              }
            }
          }
      } catch (error: any) { 
          console.error(error);
          toast.error("AI generation failed"); 
      }
      setIsGeneratingAi(false);
  };

  const handleSvgConversion = async () => {
    setIsConvertingSvg(true);
    try {
        const response = await fetch('https://imagetosvg.p.rapidapi.com/servizi/immagini/convertifiletosvg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-rapidapi-host': 'imagetosvg.p.rapidapi.com', 'x-rapidapi-key': '9510fcce0bmshb978bb7926d6d12p15b6b5jsn33d7c3673303' },
            body: new URLSearchParams({ url: svgUrl })
        });
        const data = await response.json() as any;
        const svgResponse = await fetch(data.output_url || data.url);
        handleAddAsset(await svgResponse.text());
        setShowAddMenu(false);
    } catch (error: any) { 
        console.error(error);
        toast.error("Conversion failed"); 
    }
    setIsConvertingSvg(false);
  };

  useEffect(() => {
    if (!isPlaying || timelineImages.length === 0) return;
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const currentImage = timelineImages[currentImageIndex];
      setProgress(prev => {
        if (prev < 0) return prev + delta / (currentImage.transition.duration || 1);
        
        // MAX_PROGRESS is 2.0. So 2.0 / duration gives speed in units/sec.
        const progressPerSec = MAX_PROGRESS / currentImage.duration;
        const nextVal = prev + (delta * speed * progressPerSec);
        
        // Calculate the threshold including the 2-second pause
        // Rate = MAX_PROGRESS / duration
        // Pause Progress = PAUSE_DURATION * Rate
        const pauseProgress = PAUSE_DURATION * progressPerSec;
        const totalProgressLimit = MAX_PROGRESS + pauseProgress;
        
        if (nextVal >= totalProgressLimit) {
          if (currentImageIndex < timelineImages.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
            // Check if NEXT transition needs pre-roll (negative progress)
            const nextType = timelineImages[currentImageIndex + 1].transition.type;
            return (nextType === 'pan' || nextType === 'paper-slide') ? -1.0 : 0;
          }
          setIsPlaying(false);
          return MAX_PROGRESS; // Reset to completed state
        }
        return nextVal;
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, currentImageIndex, timelineImages, speed]);

  const addImagesToTimeline = useCallback((imgs: HTMLImageElement[]) => {
    const newLayers: ImageLayer[] = imgs.map((img, index) => ({
        id: `layer-${Date.now()}-${index}`,
        image: img, x: (CANVAS_WIDTH - 400) / 2, y: (CANVAS_HEIGHT - 400) / 2, width: 400, height: 400,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1
    }));
    setTimelineImages(prev => {
      if (prev.length > 0) {
         const updated = [...prev];
         updated[currentImageIndex].layers = [...updated[currentImageIndex].layers, ...newLayers];
         setCurrentLayers(updated[currentImageIndex].layers);
         return updated;
      }
      return [{ id: `f-${Date.now()}`, layers: newLayers, duration: 5, order: 1, thumbnail: '', transition: { ...defaultTransition }, camera: { ...defaultCamera } }];
    });
  }, [currentImageIndex]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = (Array.from(files) as File[]).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error("Please upload image files");
      return;
    }

    const promises = validFiles.map((file: File) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then(images => {
        addImagesToTimeline(images);
      })
      .catch(() => {
        toast.error("Failed to load some images");
      });
  }, [addImagesToTimeline]);

  // Modified to use Base64 for persistence
  const handleAddAsset = useCallback((svgString: string) => {
    // Convert SVG string to base64 data URI to be portable
    const base64 = window.btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    
    const img = new Image();
    img.onload = () => { addImagesToTimeline([img]); };
    img.src = dataUrl;
  }, [addImagesToTimeline]);

  // Modified to use Base64/FileReader for persistence
  const handleAudioUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const audioFile = files[0];
    if (!audioFile.type.startsWith('audio/')) {
        toast.error("Please upload an audio file");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        const audio = new Audio(result);
        audio.onloadedmetadata = () => {
             const newTrack: AudioTrack = {
                id: `audio-${Date.now()}`,
                name: audioFile.name,
                url: result, // Store as Base64 Data URL
                duration: audio.duration,
                volume: 1.0
            };
            setAudioTracks(prev => [...prev, newTrack]);
            setShowAddMenu(false);
            toast.success("Audio track added");
        };
    };
    reader.readAsDataURL(audioFile);
  }, []);

  const handlePlayPause = () => {
    if (timelineImages.length === 0) return;
    
    if (!isPlaying) {
        lastTimeRef.current = 0;
    }

    if (progress >= MAX_PROGRESS && currentImageIndex === timelineImages.length - 1) {
      setCurrentImageIndex(0); setProgress(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleLayerTransform = (updates: Partial<ImageLayer>) => {
    if (!selectedLayerId) return;
    handleLayersUpdate(currentLayers.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  const selectedTextElement = textElements.find(el => el.id === selectedTextId);
  const selectedLayer = currentLayers.find(l => l.id === selectedLayerId);
  const isInPausePhase = progress > MAX_PROGRESS;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Toaster position="top-center" />
      <header className="bg-toolbar text-toolbar-foreground h-14 flex items-center justify-between px-4 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg"><span className="text-white font-bold text-sm">SC</span></div>
            <span className="font-display font-semibold text-sm">Sketch Canvas</span>
          </div>
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/5">
              <button onClick={() => setTool('select')} className={cn("p-1.5 rounded", tool === 'select' ? "bg-white/20 text-white" : "text-gray-400")}><MousePointer2 className="w-4 h-4" /></button>
              <button onClick={() => setTool('hand')} className={cn("p-1.5 rounded", tool === 'hand' ? "bg-white/20 text-white" : "text-gray-400")}><Hand className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1">
              <button onClick={() => handleCameraUpdate({...camera, zoom: camera.zoom * 0.9})} className="p-1.5 text-gray-400"><ZoomOut className="w-3 h-3" /></button>
              <span className="text-xs w-10 text-center">{Math.round(camera.zoom * 100)}%</span>
              <button onClick={() => handleCameraUpdate({...camera, zoom: camera.zoom * 1.1})} className="p-1.5 text-gray-400"><ZoomIn className="w-3 h-3" /></button>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-r pr-2 mr-2 border-white/10">
                <button onClick={() => projectFileInputRef.current?.click()} className="flex flex-col items-center justify-center w-12 h-12 rounded hover:bg-white/10 text-gray-200" title="Open Project">
                    <FolderOpen className="w-5 h-5 mb-1" />
                    <span className="text-[9px]">Open</span>
                </button>
                <input ref={projectFileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
                
                <button onClick={handleSaveProject} className="flex flex-col items-center justify-center w-12 h-12 rounded hover:bg-white/10 text-gray-200" title="Save Project">
                    <Save className="w-5 h-5 mb-1" />
                    <span className="text-[9px]">Save</span>
                </button>
            </div>

          <button onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center justify-center w-14 h-12 rounded hover:bg-white/10"><ImageIcon className="w-5 h-5 mb-1" /><span className="text-[10px] opacity-80">Upload</span></button>
          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          <button onClick={() => setShowAddMenu(!showAddMenu)} className={cn("flex flex-col items-center justify-center w-14 h-12 rounded transition-colors relative", showAddMenu ? "bg-white/20" : "hover:bg-white/10")}><Plus className="w-5 h-5 mb-1" /><span className="text-[10px] opacity-80">Add</span></button>
          <button onClick={() => setTextElements([...textElements, { id: `t-${Date.now()}`, text: 'New Text', x: 100, y: 100, fontSize: 32, fontFamily: 'sans-serif', color: '#000000', bold: false, italic: false, align: 'left' }])} className="flex flex-col items-center justify-center w-14 h-12 rounded hover:bg-white/10"><Type className="w-5 h-5 mb-1" /><span className="text-[10px] opacity-80">Text</span></button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handlePlayPause} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-white", isPlaying ? "bg-amber-500" : "bg-indigo-600")}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}<span className="text-sm font-medium">{isPlaying ? 'Pause' : 'Preview'}</span></button>
          <ExportDialog
              timeline={timelineImages}
              audioTracks={audioTracks}
              canvasRef={canvasRef}
              isPlaying={isPlaying}
              onStartPlayback={() => {
                 lastTimeRef.current = 0;
                 setIsPlaying(true);
              }}
              onStopPlayback={() => setIsPlaying(false)}
              onSeek={(index, p) => {
                 setCurrentImageIndex(index);
                 setProgress(p);
              }}
          />
           <button 
             onClick={() => setShowHistory(!showHistory)} 
             className={cn("p-2 rounded-lg transition-colors relative", showHistory ? "bg-white/20 text-white" : "hover:bg-white/10 text-gray-200")}
             title="Project History"
           >
             <History className="w-5 h-5" />
             {history.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-toolbar" />}
           </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (
        <div className="absolute top-16 right-4 z-50 w-72 bg-white border border-border shadow-xl rounded-xl p-4 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-semibold text-sm">Project History</h3>
                </div>
                <button onClick={() => setShowHistory(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            
            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {history.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">
                        <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <p>No changes recorded yet.</p>
                        <p className="mt-1 opacity-75">Work is auto-saved as you edit.</p>
                    </div>
                ) : (
                    history.map((snapshot, index) => (
                        <div key={snapshot.id} className="group flex items-center gap-3 p-2 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                             <div className="w-10 h-10 bg-gray-100 rounded border overflow-hidden shrink-0">
                                 {snapshot.thumb ? (
                                    <img src={snapshot.thumb} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-4 h-4" /></div>
                                 )}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <div className="text-xs font-medium text-gray-900 truncate">
                                     {index === 0 ? "Current Version" : `Version ${history.length - index}`}
                                 </div>
                                 <div className="text-[10px] text-gray-500">
                                     {new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                 </div>
                             </div>
                             <button 
                                onClick={() => handleRestore(snapshot)}
                                className="p-1.5 rounded-full text-indigo-600 hover:bg-white hover:shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                title="Restore this version"
                             >
                                 <RestoreIcon className="w-4 h-4" />
                             </button>
                        </div>
                    ))
                )}
            </div>
            {history.length > 0 && (
                <div className="mt-3 pt-2 border-t text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" /> Auto-saving enabled
                </div>
            )}
        </div>
      )}

      {showAddMenu && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-80 bg-white border border-border shadow-xl rounded-xl p-4 ml-[-120px]">
            <div className="flex bg-secondary p-1 rounded-lg mb-3">
                {['shapes', 'freepik', 'ai', 'svg', 'audio'].map(tab => (
                  <button key={tab} className={cn("flex-1 text-[10px] py-1.5 rounded font-medium", activeAddTab === tab ? "bg-white shadow" : "text-muted-foreground")} onClick={() => setActiveAddTab(tab as any)}>{tab.toUpperCase()}</button>
                ))}
            </div>
            {activeAddTab === 'shapes' && <div className="grid grid-cols-4 gap-2">{SVG_ASSETS.map((a, i) => <button key={i} onClick={() => handleAddAsset(a.src)} className="aspect-square border rounded-lg p-2 hover:bg-secondary flex items-center justify-center" dangerouslySetInnerHTML={{ __html: a.src }} />)}</div>}
            {activeAddTab === 'freepik' && <div className="space-y-3"><div className="flex gap-2"><input className="flex-1 text-xs p-2 border rounded" placeholder="Search..." value={freepikQuery} onChange={e => setFreepikQuery(e.target.value)} /><button onClick={handleFreepikSearch} className="p-2 bg-blue-600 text-white rounded"><Search className="w-4 h-4" /></button></div><div className="grid grid-cols-3 gap-2">{freepikImages.map(img => <button key={img.id} onClick={() => handleImportFreepik(img.preview?.url)} className="aspect-square border overflow-hidden rounded"><img src={img.preview?.url} className="w-full h-full object-cover" /></button>)}</div></div>}
            {activeAddTab === 'ai' && <div className="space-y-3"><textarea className="w-full text-sm p-2 border rounded" placeholder="E.g. A cat" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} /><button onClick={handleGenerateAi} disabled={isGeneratingAi} className="w-full py-2 bg-indigo-600 text-white rounded text-xs">{isGeneratingAi ? 'Generating...' : 'Generate 2D Asset'}</button></div>}
            {activeAddTab === 'svg' && <div className="space-y-3"><input className="w-full text-sm p-2 border rounded" placeholder="Image URL" value={svgUrl} onChange={e => setSvgUrl(e.target.value)} /><button onClick={handleSvgConversion} disabled={isConvertingSvg} className="w-full py-2 bg-emerald-600 text-white rounded text-xs">{isConvertingSvg ? 'Converting...' : 'Convert to SVG'}</button></div>}
            {activeAddTab === 'audio' && (
                <div className="space-y-3 text-center">
                    <div 
                        onClick={() => audioInputRef.current?.click()} 
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all"
                    >
                        <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                        <span className="text-xs text-gray-600 font-medium">Click to Upload MP3/WAV</span>
                    </div>
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </div>
            )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-canvas">
          <div className="flex-1 relative p-8 flex items-center justify-center overflow-hidden bg-gray-100">
            {timelineImages.length === 0 ? (
              <div className="w-full max-w-2xl"><ImageUploader onUpload={addImagesToTimeline} className="min-h-[400px] shadow-xl bg-white" /></div>
            ) : (
              <div 
                  ref={canvasContainerRef} 
                  className={cn(
                      "relative shadow-2xl bg-white overflow-hidden ring-1 ring-black/5", 
                      tool === 'hand' ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  )} 
                  style={{ 
                      aspectRatio: '16/9',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '100%'
                  }} 
                  onWheel={handleCanvasWheel} 
                  onMouseDown={handleCanvasMouseDown} 
                  onMouseMove={handleCanvasMouseMove} 
                  onMouseUp={handleCanvasMouseUp}
              >
                <WhiteboardCanvas 
                    ref={canvasRef}
                    layers={currentLayers} 
                    textElements={textElements} 
                    previousLayers={currentImageIndex > 0 ? timelineImages[currentImageIndex - 1].layers : []}
                    transition={timelineImages[currentImageIndex]?.transition} 
                    camera={camera} 
                    isPlaying={isPlaying} 
                    progress={progress} 
                    speed={speed} 
                    settings={settings} 
                    onProgressChange={setProgress} 
                    onComplete={() => {}} 
                    onExportDataReady={setExportData} 
                    onHandMove={handleHandMove} 
                    className="w-full h-full pointer-events-none" 
                />
                {progress >= 0 && !isPlaying && (
                    <>
                        <ImageLayerOverlay 
                            layers={currentLayers} 
                            onLayersChange={handleLayersUpdate} 
                            selectedLayerId={selectedLayerId} 
                            onSelectLayer={handleLayerSelect} 
                            containerRef={canvasContainerRef} 
                            camera={camera} 
                            onReorder={handleLayerReorder}
                        />
                        <TextOverlay elements={textElements} onElementsChange={setTextElements} selectedId={selectedTextId} onSelect={setSelectedTextId} containerRef={canvasContainerRef} camera={camera} />
                    </>
                )}
              </div>
            )}
          </div>
          {showTimeline && (
            <div className="h-64 bg-gray-50 border-t border-border flex flex-col z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="h-10 flex items-center justify-between px-4 border-b bg-white">
                <div className="flex items-center gap-2">
                    <button onClick={() => setProgress(0)} className="p-1 hover:bg-gray-200 rounded"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={handlePlayPause} className="p-1 bg-indigo-600 text-white rounded"><Play className="w-4 h-4" /></button>
                    <div className="h-4 w-px bg-gray-300 mx-2" />
                    <button onClick={handleAddFrame} className="flex items-center gap-1 p-1 bg-white border hover:bg-gray-50 rounded text-xs px-2 shadow-sm font-medium"><PlusSquare className="w-3 h-3" /> Add Frame</button>
                </div>
              </div>
              <div className="flex-1 relative">
                  <TimelineTrack 
                     images={timelineImages} 
                     onImagesChange={setTimelineImages} 
                     currentIndex={currentImageIndex} 
                     progress={Math.min(progress, MAX_PROGRESS) / MAX_PROGRESS} 
                     onSeek={(i, p) => { 
                         setCurrentImageIndex(i); 
                         setProgress(p); 
                         setIsPlaying(false); 
                     }} 
                     isPlaying={isPlaying} 
                  />
              </div>
            </div>
          )}
        </div>

        {showRightPanel ? (
          <div className="w-80 bg-white border-l overflow-y-auto shrink-0 custom-scrollbar flex flex-col z-20">
             <div className="h-12 flex items-center justify-between px-4 border-b bg-gray-50"><h3 className="font-semibold text-sm">Properties</h3><button onClick={() => setShowRightPanel(false)}><ChevronRight className="w-4 h-4" /></button></div>
             <div className="p-4 space-y-6">
                <div className="bg-gray-50 border rounded-lg p-3 space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Transition</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleTransitionUpdate({ type: 'cut' })} className={cn("flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] border rounded-md transition-all", timelineImages[currentImageIndex]?.transition.type === 'cut' ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-gray-50")}>
                           <Zap className="w-4 h-4" /> <span>Cut</span>
                        </button>
                        <button onClick={() => handleTransitionUpdate({ type: 'pan' })} className={cn("flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] border rounded-md transition-all", timelineImages[currentImageIndex]?.transition.type === 'pan' ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-gray-50")}>
                           <MoveRight className="w-4 h-4" /> <span>Pan</span>
                        </button>
                         <button onClick={() => handleTransitionUpdate({ type: 'paper-slide' })} className={cn("flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] border rounded-md transition-all", timelineImages[currentImageIndex]?.transition.type === 'paper-slide' ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-gray-50")}>
                           <StickyNote className="w-4 h-4" /> <span>Paper</span>
                        </button>
                        <button onClick={() => handleTransitionUpdate({ type: 'fade' })} className={cn("flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] border rounded-md transition-all", timelineImages[currentImageIndex]?.transition.type === 'fade' ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-gray-50")}>
                           <Minimize2 className="w-4 h-4" /> <span>Fade</span>
                        </button>
                        <button onClick={() => handleTransitionUpdate({ type: 'zoom' })} className={cn("flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] border rounded-md transition-all", timelineImages[currentImageIndex]?.transition.type === 'zoom' ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white hover:bg-gray-50")}>
                           <Maximize2 className="w-4 h-4" /> <span>Zoom</span>
                        </button>
                    </div>
                </div>
                {audioTracks.length > 0 && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <AudioManager 
                            tracks={audioTracks} 
                            onTracksChange={setAudioTracks} 
                            isPlaying={isPlaying && !isInPausePhase} 
                            currentTime={globalTime}
                        />
                    </div>
                )}
                {selectedLayer && (
                   <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-3">
                      <div className="text-xs font-bold text-indigo-800 flex items-center justify-between border-b border-indigo-200 pb-2 mb-2">
                        <span className="flex items-center gap-2"><Layers className="w-3 h-3" /> Layer Options</span>
                        <div className="flex items-center gap-1">
                             <button onClick={() => handleLayerReorder('up')} className="p-1 hover:bg-indigo-200 rounded text-indigo-700" title="Bring to Front"><MoveUp className="w-3 h-3" /></button>
                             <button onClick={() => handleLayerReorder('down')} className="p-1 hover:bg-indigo-200 rounded text-indigo-700" title="Send to Back"><MoveDown className="w-3 h-3" /></button>
                        </div>
                      </div>
                      
                      <div>
                         <label className="text-xs text-indigo-700 font-medium mb-1 block">Scale (Size)</label>
                         <input type="range" min="0.1" max="3" step="0.1" value={selectedLayer.scaleX} onChange={(e) => handleLayerTransform({ scaleX: Number(e.target.value), scaleY: Number(e.target.value) })} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
                      </div>

                      <div>
                         <label className="text-xs text-indigo-700 font-medium mb-1 block">Rotation</label>
                         <input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(e) => handleLayerTransform({ rotation: Number(e.target.value) })} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer" />
                      </div>

                      <div>
                         <label className="text-xs text-indigo-700 font-medium mb-1 block">Quick Actions</label>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleLayerTransform({ scaleX: selectedLayer.scaleX * -1 })} className={cn("py-1.5 text-[10px] border rounded bg-white hover:bg-indigo-50", selectedLayer.scaleX < 0 ? "text-indigo-600 border-indigo-300" : "")}><FlipHorizontal className="w-3 h-3 mx-auto" /> Flip H</button>
                            <button onClick={() => handleLayerTransform({ scaleY: selectedLayer.scaleY * -1 })} className={cn("py-1.5 text-[10px] border rounded bg-white hover:bg-indigo-50", selectedLayer.scaleY < 0 ? "text-indigo-600 border-indigo-300" : "")}><FlipVertical className="w-3 h-3 mx-auto" /> Flip V</button>
                         </div>
                      </div>
                      
                      <button onClick={handleRemoveBackground} className="w-full flex items-center justify-center gap-2 py-1.5 text-xs bg-white border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-50"><Eraser className="w-3 h-3" /> Remove Background</button>
                      <button onClick={() => handleLayersUpdate(currentLayers.filter(l => l.id !== selectedLayerId))} className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 py-2 text-xs rounded hover:bg-red-100 mt-2"><Trash2 className="w-3 h-3" /> Delete Layer</button>
                   </div>
                )}
                {showSettings && <SettingsPanel settings={settings} onSettingsChange={setSettings} speed={speed} onSpeedChange={setSpeed} />}
                {selectedTextElement && <TextEditorPanel element={selectedTextElement} onUpdate={(u) => setTextElements(textElements.map(e => e.id === selectedTextId ? {...e, ...u} : e))} />}
             </div>
          </div>
        ) : (
           <div className="w-4 relative border-l"><button onClick={() => setShowRightPanel(true)} className="absolute top-1/2 -left-3 bg-white border rounded-l-lg p-1"><ChevronLeft className="w-4 h-4" /></button></div>
        )}
      </div>
    </div>
  );
};

export default App;
