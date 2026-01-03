import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { AnimationSettings, CanvasExportData, MarkerPoint, SegmentTiming, TimelineImage, AudioTrack, TextElement as TextType, ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT, CameraTransition } from './types';
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
  MonitorPlay
} from 'lucide-react';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';

const defaultSettings: AnimationSettings = {
  brushThickness: 2,
  paperColor: '#ffffff',
  showHand: true,
  handStyle: 'realistic',
  strokeSmoothness: 0.5,
  drawingOrder: 'top-to-bottom',
  edgeSensitivity: 0.5,
  lineStyle: 'pencil',
};

const defaultTransition: CameraTransition = {
  type: 'cut',
  direction: 'right',
  duration: 1.0
};

const MAX_PROGRESS = 2.0; // 0-1: Sketch, 1-2: Color

const App = () => {
  // State
  const [timelineImages, setTimelineImages] = useState<TimelineImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [settings, setSettings] = useState<AnimationSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [exportData, setExportData] = useState<CanvasExportData | null>(null);
  
  // Layer & Selection State
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [currentLayers, setCurrentLayers] = useState<ImageLayer[]>([]);

  // Other state
  const [customMarkers, setCustomMarkers] = useState<MarkerPoint[]>([]);
  const [isMarkerEditMode, setIsMarkerEditMode] = useState(false);
  const [segmentTimings, setSegmentTimings] = useState<SegmentTiming[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [textElements, setTextElements] = useState<TextType[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  
  // Refs
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Sync current layers from timeline to local state when frame changes
  useEffect(() => {
    if (timelineImages.length > 0 && currentImageIndex < timelineImages.length) {
      setCurrentLayers(timelineImages[currentImageIndex].layers);
    } else if (timelineImages.length === 0) {
      setCurrentLayers([]);
    }
  }, [currentImageIndex, timelineImages]); 

  // Sync local layers back to timeline when modified (e.g. drag/resize)
  const handleLayersUpdate = useCallback((newLayers: ImageLayer[]) => {
    setCurrentLayers(newLayers);
    setTimelineImages(prev => prev.map((img, idx) => 
      idx === currentImageIndex ? { ...img, layers: newLayers } : img
    ));
  }, [currentImageIndex]);

  // Handle Transition Updates
  const handleTransitionUpdate = useCallback((updates: Partial<CameraTransition>) => {
    setTimelineImages(prev => prev.map((img, idx) => 
      idx === currentImageIndex ? { ...img, transition: { ...img.transition, ...updates } } : img
    ));
  }, [currentImageIndex]);

  // Timeline animation loop
  useEffect(() => {
    if (!isPlaying || timelineImages.length === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const currentImage = timelineImages[currentImageIndex];
    if (!currentImage) return;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000; 
      lastTimeRef.current = timestamp;

      setProgress(prev => {
        // Handle Transition Phase (Negative Progress)
        if (prev < 0) {
          // Transition speed is based on transition duration, not image duration
          const transitionDuration = currentImage.transition.duration || 1.0;
          const increment = (delta * speed) / transitionDuration;
          return prev + increment;
        }

        // Automatic Speed Adjustment based on Phase
        // Phase 1 (Sketch < 1.0): 0.1x speed
        // Phase 2 (Color >= 1.0): 2.0x speed
        const phaseMultiplier = prev < 1.0 ? 0.1 : 2.0;

        const increment = (delta * speed * phaseMultiplier) / currentImage.duration;
        const newProgress = prev + increment;
        
        if (newProgress >= MAX_PROGRESS) {
          if (currentImageIndex < timelineImages.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
            
            // Setup start progress for next frame based on transition
            const nextImage = timelineImages[currentImageIndex + 1];
            if (nextImage.transition.type === 'pan') {
               return -1.0; // Start at -1.0 (full transition start)
            }
            return 0; 
          } else {
            setIsPlaying(false);
            return MAX_PROGRESS;
          }
        }
        return newProgress;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentImageIndex, timelineImages, speed]);

  useEffect(() => {
    if (!isPlaying) lastTimeRef.current = 0;
  }, [isPlaying]);

  const addImagesToTimeline = useCallback((imgs: HTMLImageElement[]) => {
    const newLayers: ImageLayer[] = imgs.map((img, index) => {
        const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height) * 0.6;
        const width = img.width * scale;
        const height = img.height * scale;
        const offsetX = (index * 20) % 100;
        const offsetY = (index * 20) % 100;
        const x = (CANVAS_WIDTH - width) / 2 + offsetX;
        const y = (CANVAS_HEIGHT - height) / 2 + offsetY;

        return {
            id: `layer-${Date.now()}-${index}`,
            image: img,
            x, y, width, height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1
        };
    });

    setTimelineImages(prev => {
      if (prev.length > 0) {
         const updatedImages = [...prev];
         const currentFrame = updatedImages[currentImageIndex];
         currentFrame.layers = [...currentFrame.layers, ...newLayers];
         setCurrentLayers(currentFrame.layers);
         toast.success(`${imgs.length} image(s) added to current frame`);
         return updatedImages;
      } else {
         const canvas = document.createElement('canvas');
         canvas.width = 80; canvas.height = 60;
         const ctx = canvas.getContext('2d');
         if(ctx && imgs[0]) {
            ctx.fillStyle = '#fff'; ctx.fillRect(0,0,80,60);
            const ts = Math.min(80/imgs[0].width, 60/imgs[0].height);
            ctx.drawImage(imgs[0], (80-imgs[0].width*ts)/2, (60-imgs[0].height*ts)/2, imgs[0].width*ts, imgs[0].height*ts);
         }

         const newImage: TimelineImage = {
           id: `frame-${Date.now()}`,
           layers: newLayers,
           duration: 5,
           order: 1,
           thumbnail: canvas.toDataURL(),
           transition: { ...defaultTransition }
         };
         
         setCurrentImageIndex(0);
         setProgress(0);
         setCurrentLayers(newLayers);
         toast.success('New frame created');
         return [newImage];
      }
    });
  }, [currentImageIndex]);

  const handlePlayPause = useCallback(() => {
    if (timelineImages.length === 0) {
      toast.info('Add images first');
      return;
    }
    if (progress >= MAX_PROGRESS && currentImageIndex === timelineImages.length - 1) {
      // Restart
      setCurrentImageIndex(0);
      // Check if first frame has transition (usually no, but logic handles it)
      if (timelineImages[0].transition.type === 'pan') {
         setProgress(-1.0);
      } else {
         setProgress(0);
      }
      setIsPlaying(true);
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [timelineImages, progress, currentImageIndex]);

  const handleRestart = useCallback(() => {
    setCurrentImageIndex(0);
    setProgress(0);
    setIsPlaying(true);
  }, []);

  const handleTimelineSeek = useCallback((index: number, localProgress: number) => {
    setCurrentImageIndex(index);
    setProgress(localProgress);
    setIsPlaying(false);
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files) as File[];
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) { toast.error("Please upload image files"); return; }

    const promises = validFiles.map(file => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new window.Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    });

    Promise.all(promises).then(images => addImagesToTimeline(images));
    e.target.value = '';
  }, [addImagesToTimeline]);

  const handleAddText = useCallback(() => {
    const newText: TextType = {
      id: `text-${Date.now()}`,
      text: 'Double-click to edit',
      x: 100,
      y: 100,
      fontSize: 32,
      fontFamily: 'sans-serif',
      color: '#000000',
      bold: false,
      italic: false,
      align: 'left',
    };
    setTextElements(prev => [...prev, newText]);
    setSelectedTextId(newText.id);
    toast.success('Text added');
  }, []);

  const createNewFrame = useCallback(() => {
      setTimelineImages(prev => [
          ...prev, 
          {
             id: `frame-${Date.now()}`,
             layers: [],
             duration: 5,
             order: prev.length + 1,
             thumbnail: '',
             transition: { ...defaultTransition }
          }
      ]);
      setCurrentImageIndex(prev => prev === 0 && timelineImages.length === 0 ? 0 : timelineImages.length);
      setCurrentLayers([]);
      toast.success("Empty frame created");
  }, [timelineImages.length]);

  const selectedTextElement = textElements.find(el => el.id === selectedTextId) || null;
  const selectedLayer = currentLayers.find(l => l.id === selectedLayerId);
  const currentTransition = timelineImages[currentImageIndex]?.transition || defaultTransition;

  const handleLayerTransform = (updates: Partial<ImageLayer>) => {
    if (!selectedLayerId) return;
    const newLayers = currentLayers.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l);
    handleLayersUpdate(newLayers);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Toaster position="top-center" />
      {/* Top Toolbar */}
      <header className="bg-toolbar text-toolbar-foreground h-14 flex items-center justify-between px-4 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">SC</span>
            </div>
            <span className="font-display font-semibold text-sm hidden sm:block">Sketch Canvas</span>
          </div>
          <div className="h-6 w-px bg-toolbar-foreground/20" />
          <div className="flex items-center gap-1 opacity-80">
            <button className="p-2 rounded hover:bg-white/10" title="Save"><Save className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center justify-center w-14 h-12 rounded hover:bg-white/10">
            <ImageIcon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium opacity-80">Add Img</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          
          <button onClick={createNewFrame} className="flex flex-col items-center justify-center w-14 h-12 rounded hover:bg-white/10">
            <PlusSquare className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium opacity-80">New Frame</span>
          </button>
          
          <button onClick={() => setShowCameraMenu(!showCameraMenu)} className={cn("flex flex-col items-center justify-center w-14 h-12 rounded transition-colors relative", showCameraMenu ? "bg-white/20" : "hover:bg-white/10")}>
            <Camera className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium opacity-80">Camera</span>
            {showCameraMenu && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 w-4 h-4 bg-background rotate-45 border-l border-t border-border z-50"></div>
            )}
          </button>

          <div className="w-px h-8 bg-white/10 mx-1" />

          <button onClick={handleAddText} className="flex flex-col items-center justify-center w-14 h-12 rounded hover:bg-white/10">
            <Type className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium opacity-80">Text</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handlePlayPause}
            className={cn(
               "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
               isPlaying 
                 ? "bg-amber-500 hover:bg-amber-600 text-white" 
                 : "bg-indigo-600 hover:bg-indigo-700 text-white"
            )}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="text-sm font-medium">{isPlaying ? 'Pause' : 'Preview'}</span>
          </button>
          
          {exportData && currentLayers.length > 0 && (
            <ExportDialog
              image={currentLayers[0]?.image} 
              settings={settings}
              drawFunction={exportData.drawAtProgress}
              dimensions={exportData.dimensions}
              disabled={isPlaying}
            />
          )}

          <button onClick={() => setShowSettings(!showSettings)} className={cn("p-2 rounded hover:bg-white/10", showSettings && "bg-white/10")}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Camera Menu Dropdown */}
      {showCameraMenu && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-72 bg-card border border-border shadow-xl rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" /> 
                    Camera Transition
                </h3>
                <button onClick={() => setShowCameraMenu(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
            </div>
            
            {currentImageIndex === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 bg-secondary/50 rounded-lg">
                    Transitions are available on frames after the first one.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium">Transition Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => handleTransitionUpdate({ type: 'cut' })}
                                className={cn("p-2 text-xs border rounded-md flex flex-col items-center gap-1 hover:bg-secondary", currentTransition.type === 'cut' && "bg-primary/10 border-primary text-primary")}
                            >
                                <MonitorPlay className="w-4 h-4" />
                                <span>Cut (Instant)</span>
                            </button>
                            <button 
                                onClick={() => handleTransitionUpdate({ type: 'pan' })}
                                className={cn("p-2 text-xs border rounded-md flex flex-col items-center gap-1 hover:bg-secondary", currentTransition.type === 'pan' && "bg-primary/10 border-primary text-primary")}
                            >
                                <MoveRight className="w-4 h-4" />
                                <span>Pan Camera</span>
                            </button>
                        </div>
                    </div>

                    {currentTransition.type === 'pan' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Pan Direction</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {['left', 'right', 'up', 'down'].map((dir) => (
                                        <button
                                            key={dir}
                                            onClick={() => handleTransitionUpdate({ direction: dir as any })}
                                            className={cn(
                                                "p-1.5 text-[10px] capitalize border rounded hover:bg-secondary",
                                                currentTransition.direction === dir && "bg-primary/10 border-primary text-primary"
                                            )}
                                        >
                                            {dir}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-xs font-medium">Duration</label>
                                    <span className="text-xs text-muted-foreground">{currentTransition.duration}s</span>
                                </div>
                                <input 
                                    type="range" min="0.5" max="3" step="0.5" 
                                    value={currentTransition.duration}
                                    onChange={(e) => handleTransitionUpdate({ duration: Number(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden" onClick={() => setShowCameraMenu(false)}>
        <div className="flex-1 flex flex-col min-w-0 bg-canvas">
          {/* Canvas Wrapper */}
          <div className="flex-1 relative p-8 flex items-center justify-center overflow-hidden bg-gray-100">
            {timelineImages.length === 0 ? (
              <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500">
                <ImageUploader 
                  onUpload={addImagesToTimeline}
                  className="min-h-[400px] shadow-xl bg-white"
                />
              </div>
            ) : (
              <div 
                ref={canvasContainerRef}
                className="relative shadow-2xl bg-white overflow-hidden"
                style={{ 
                    aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
                    height: '100%', 
                    maxHeight: '100%',
                    maxWidth: '100%' 
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTextId(null);
                    setSelectedLayerId(null);
                }}
              >
                <WhiteboardCanvas
                  layers={currentLayers}
                  previousLayers={currentImageIndex > 0 ? timelineImages[currentImageIndex - 1].layers : []}
                  transition={currentTransition}
                  isPlaying={isPlaying}
                  progress={progress}
                  speed={speed}
                  settings={settings}
                  onProgressChange={setProgress}
                  onComplete={() => {}}
                  onExportDataReady={setExportData}
                  className="w-full h-full"
                />
                
                {/* Overlays only active when not transitioning */}
                {progress >= 0 && (
                    <>
                        <ImageLayerOverlay
                        layers={currentLayers}
                        onLayersChange={handleLayersUpdate}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={setSelectedLayerId}
                        containerRef={canvasContainerRef}
                        readOnly={isPlaying}
                        />

                        <TextOverlay
                        elements={textElements}
                        onElementsChange={setTextElements}
                        selectedId={selectedTextId}
                        onSelect={setSelectedTextId}
                        containerRef={canvasContainerRef}
                        />
                    </>
                )}
                
                {/* Canvas Info */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/10 rounded text-[10px] font-mono text-black/50 pointer-events-none z-30">
                  {CANVAS_WIDTH}x{CANVAS_HEIGHT}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Timeline */}
          {showTimeline && (
            <div className="h-48 bg-white border-t border-border shrink-0 flex flex-col z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="h-10 flex items-center justify-between px-4 border-b border-border bg-gray-50">
                <div className="flex items-center gap-2">
                   <button onClick={handleRestart} className="p-1 hover:bg-gray-200 rounded text-gray-600"><RotateCcw className="w-4 h-4" /></button>
                   <button onClick={handlePlayPause} className="p-1 bg-indigo-600 text-white rounded"><Play className="w-4 h-4" /></button>
                </div>
                <div className="text-xs text-gray-500 font-mono flex items-center gap-3">
                  <span>FRAME: {timelineImages.length > 0 ? `${currentImageIndex + 1}/${timelineImages.length}` : '-'}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", 
                      progress < 0 ? "bg-purple-100 text-purple-700" :
                      progress <= 1 ? "bg-amber-100 text-amber-700" : 
                      "bg-emerald-100 text-emerald-700"
                  )}>
                    {progress < 0 ? 'TRANSITION' : progress <= 1 ? 'PHASE 1: SKETCH' : 'PHASE 2: COLOR'}
                  </span>
                  <span>{progress < 0 ? Math.round((1 + progress) * 100) : Math.round(progress * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  {[0.1, 0.25, 0.5, 1, 2, 3].map(s => (
                    <button key={s} onClick={() => setSpeed(s)} className={cn("px-2 text-[10px] rounded border", speed === s ? "bg-indigo-100 border-indigo-300" : "bg-white")}>{s}x</button>
                  ))}
                </div>
              </div>

              <div className="h-1 bg-gray-200 relative w-full">
                {/* If in transition, show purple bar */}
                <div 
                    className={cn("absolute h-full transition-all duration-75", progress < 0 ? "bg-purple-500" : "bg-indigo-500")} 
                    style={{ width: `${progress < 0 ? (1 + progress) * 100 : (progress / MAX_PROGRESS) * 100}%` }} 
                />
              </div>

              <div className="flex-1 p-4 overflow-hidden bg-white">
                <TimelineTrack
                  images={timelineImages}
                  onImagesChange={setTimelineImages}
                  currentIndex={currentImageIndex}
                  progress={progress >= 0 ? progress / MAX_PROGRESS : (1 + progress)}
                  onSeek={handleTimelineSeek}
                  isPlaying={isPlaying}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        {showRightPanel ? (
          <div className="w-80 bg-white border-l border-border overflow-y-auto shrink-0 custom-scrollbar flex flex-col z-20">
             <div className="h-12 flex items-center justify-between px-4 border-b bg-gray-50">
                <h3 className="font-semibold text-sm">Properties</h3>
                <button onClick={() => setShowRightPanel(false)}><ChevronRight className="w-4 h-4" /></button>
             </div>
             
             <div className="p-4 space-y-6">
                {selectedLayer ? (
                   <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-3">
                      <div className="text-xs font-bold text-indigo-800 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Selected Layer
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                         <div>X: {Math.round(selectedLayer.x)}</div>
                         <div>Y: {Math.round(selectedLayer.y)}</div>
                         <div>W: {Math.round(selectedLayer.width)}</div>
                         <div>H: {Math.round(selectedLayer.height)}</div>
                      </div>
                      <div className="border-t border-indigo-200 pt-2">
                         <label className="text-xs text-indigo-700 font-medium mb-1 block">Rotation: {selectedLayer.rotation}°</label>
                         <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleLayerTransform({ rotation: (selectedLayer.rotation - 90) % 360 })}
                                className="p-1 bg-white rounded border hover:bg-indigo-50"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </button>
                            <input 
                               type="range" 
                               min="-180" 
                               max="180" 
                               value={selectedLayer.rotation}
                               onChange={(e) => handleLayerTransform({ rotation: Number(e.target.value) })}
                               className="flex-1 h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <button 
                                onClick={() => handleLayerTransform({ rotation: (selectedLayer.rotation + 90) % 360 })}
                                className="p-1 bg-white rounded border hover:bg-indigo-50"
                            >
                                <RotateCw className="w-3 h-3" />
                            </button>
                         </div>
                      </div>
                      <div className="border-t border-indigo-200 pt-2">
                         <label className="text-xs text-indigo-700 font-medium mb-1 block">Flip</label>
                         <div className="flex gap-2">
                            <button 
                                onClick={() => handleLayerTransform({ scaleX: (selectedLayer.scaleX || 1) * -1 })}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border rounded bg-white hover:bg-indigo-50 transition-colors",
                                    selectedLayer.scaleX === -1 && "bg-indigo-100 border-indigo-300 text-indigo-800"
                                )}
                            >
                                <ArrowLeftRight className="w-3 h-3" /> Horizontal
                            </button>
                            <button 
                                onClick={() => handleLayerTransform({ scaleY: (selectedLayer.scaleY || 1) * -1 })}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border rounded bg-white hover:bg-indigo-50 transition-colors",
                                    selectedLayer.scaleY === -1 && "bg-indigo-100 border-indigo-300 text-indigo-800"
                                )}
                            >
                                <ArrowUpDown className="w-3 h-3" /> Vertical
                            </button>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleLayersUpdate(currentLayers.filter(l => l.id !== selectedLayerId))}
                        className="w-full mt-2 bg-white border border-red-200 text-red-600 py-1.5 text-xs rounded hover:bg-red-50"
                      >
                        Delete Layer
                      </button>
                   </div>
                ) : (
                   <div className="text-center py-4 border-2 border-dashed border-gray-100 rounded-lg">
                      <p className="text-xs text-gray-400">Select a layer to edit</p>
                   </div>
                )}

                {showSettings && <SettingsPanel settings={settings} onSettingsChange={setSettings} />}
                {selectedTextElement && <TextEditorPanel element={selectedTextElement} onUpdate={(u) => setTextElements(p => p.map(e => e.id === selectedTextId ? {...e, ...u} : e))} />}
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