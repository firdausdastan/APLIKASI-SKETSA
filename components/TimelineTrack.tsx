
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { TimelineImage } from '@/types';
import { cn, formatTime } from '@/lib/utils';
import { GripVertical, X, Layers, Clock, Zap, ArrowRight, Trash2 } from 'lucide-react';

interface TimelineTrackProps {
  images: TimelineImage[];
  onImagesChange: (images: TimelineImage[]) => void;
  currentIndex: number;
  progress: number; // Normalized 0-2 per slide
  onSeek: (index: number, progress: number) => void;
  isPlaying: boolean;
}

const PX_PER_SEC = 40; // Scale: 40px width = 1 second
const MIN_CLIP_WIDTH = 100; // Minimum visual width for controls
const MAX_PROGRESS = 2.0;

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  images,
  onImagesChange,
  currentIndex,
  progress,
  onSeek,
  isPlaying,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  // --- Calculations ---

  // Calculate accumulated start times for each clip
  const clipMeta = useMemo(() => {
    let accTime = 0;
    return images.map((img) => {
      const startTime = accTime;
      const width = Math.max(MIN_CLIP_WIDTH, img.duration * PX_PER_SEC);
      accTime += img.duration;
      return { ...img, startTime, width, endTime: accTime };
    });
  }, [images]);

  const totalDuration = clipMeta.length > 0 ? clipMeta[clipMeta.length - 1].endTime : 0;
  const totalWidth = clipMeta.reduce((acc, clip) => acc + clip.width, 0);

  // Calculate Global Current Time based on active index and progress
  const currentGlobalTime = useMemo(() => {
    if (images.length === 0) return 0;
    const activeClip = clipMeta[currentIndex];
    if (!activeClip) return 0;
    // progress is 0-2.0, map to duration (0-100%)
    return activeClip.startTime + (activeClip.duration * (progress / MAX_PROGRESS));
  }, [currentIndex, progress, clipMeta, images.length]);

  // --- Interaction Handlers ---

  const handleSeek = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = clientX - rect.left + scrollLeft;
    
    // Find which clip corresponds to this X position
    let currentX = 0;
    for (let i = 0; i < clipMeta.length; i++) {
        const clip = clipMeta[i];
        if (clickX >= currentX && clickX <= currentX + clip.width) {
            // Found the clip
            const offsetInClip = clickX - currentX;
            // Map visual width back to time duration
            // localProgress = offset / width
            const localPercent = Math.max(0, Math.min(1, offsetInClip / clip.width));
            
            // Calculate raw time for display during drag
            const rawTime = clip.startTime + (localPercent * clip.duration);
            setDragTime(rawTime);
            
            // Convert to 0-2.0 range for App
            onSeek(i, localPercent * MAX_PROGRESS); 
            return;
        }
        currentX += clip.width;
    }
    
    // If clicked past the end, go to end
    if (clickX > totalWidth && clipMeta.length > 0) {
       onSeek(clipMeta.length - 1, MAX_PROGRESS);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleSeek(e.clientX);
      }
    };
    const handleWindowMouseUp = () => {
      setIsDragging(false);
      setDragTime(null);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, clipMeta]);

  // Auto-scroll when playing
  useEffect(() => {
      if (isPlaying && containerRef.current && !isDragging) {
          const activeClip = clipMeta[currentIndex];
          if (!activeClip) return;
          
          const currentX = clipMeta.slice(0, currentIndex).reduce((acc, c) => acc + c.width, 0) + (activeClip.width * (progress / MAX_PROGRESS));
          const container = containerRef.current;
          
          // Keep playhead in center-ish if possible
          if (currentX > container.scrollLeft + container.clientWidth * 0.8 || currentX < container.scrollLeft) {
             container.scrollTo({ left: currentX - container.clientWidth * 0.2, behavior: 'smooth' });
          }
      }
  }, [currentIndex, progress, isPlaying, clipMeta, isDragging]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onImagesChange(images.filter(img => img.id !== id));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0.5) val = 0.5;
    onImagesChange(images.map(img => img.id === id ? { ...img, duration: val } : img));
  };

  // --- Rendering ---

  // Generate Ruler Ticks
  const rulerTicks = [];
  const tickInterval = 1; // every 1 second
  const totalTicks = Math.ceil(totalDuration) + 5; // Buffer
  for (let i = 0; i <= totalTicks; i += tickInterval) {
      rulerTicks.push(
          <div 
            key={i} 
            className="absolute top-0 bottom-0 border-l border-gray-300 flex flex-col justify-end pb-1"
            style={{ left: `${i * PX_PER_SEC}px` }}
          >
             <span className="text-[9px] text-gray-400 pl-1 select-none">{formatTime(i)}</span>
             <div className="h-2 w-px bg-gray-300"></div>
          </div>
      );
  }

  // Calculate Playhead Position (Visual X)
  let playheadX = 0;
  if (clipMeta.length > 0 && clipMeta[currentIndex]) {
      const prevWidths = clipMeta.slice(0, currentIndex).reduce((acc, c) => acc + c.width, 0);
      playheadX = prevWidths + (clipMeta[currentIndex].width * (progress / MAX_PROGRESS));
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 border-t border-gray-200 select-none">
       {/* Toolbar / Time Display */}
       <div className="h-8 flex items-center justify-between px-4 bg-white border-b border-gray-100 z-20 shrink-0">
          <div className="text-xs font-mono font-medium text-gray-600">
             <span className="text-indigo-600">{formatTime(dragTime ?? currentGlobalTime)}</span> 
             <span className="text-gray-300 mx-1">/</span> 
             <span>{formatTime(totalDuration)}</span>
          </div>
          <div className="text-[10px] text-gray-400">
             {images.length} Clips • Total {totalDuration.toFixed(1)}s
          </div>
       </div>

       {/* Timeline Area */}
       <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar bg-[#f8f9fc]"
          onMouseDown={handleMouseDown}
       >
          <div 
            className="relative h-full min-w-full"
            style={{ width: `${Math.max(totalWidth + 400, containerRef.current?.clientWidth || 0)}px` }} // Extra space at end
          >
             {/* Ruler Layer */}
             <div className="h-6 w-full border-b border-gray-200 relative bg-gray-50/50 pointer-events-none">
                 {/* Generate dynamic ruler based on width */}
                 <div className="absolute inset-0" style={{ transform: `scaleX(${1})` }}> 
                    {/* Simplified Ruler Render */}
                    {Array.from({ length: Math.ceil(totalDuration) + 2 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="absolute top-0 h-full border-l border-gray-300" 
                            style={{ left: i * PX_PER_SEC }}
                        >
                            <span className="absolute top-0.5 left-1 text-[9px] text-gray-400 font-mono">{i}s</span>
                        </div>
                    ))}
                 </div>
             </div>

             {/* Tracks Layer */}
             <div className="flex pt-4 pb-2 px-0 h-[calc(100%-24px)] items-center relative">
                {clipMeta.map((img, idx) => {
                    const isActive = idx === currentIndex;
                    return (
                        <div 
                            key={img.id}
                            className={cn(
                                "relative h-24 rounded-lg border bg-white flex flex-col overflow-hidden group transition-colors shadow-sm shrink-0 mr-0.5",
                                isActive ? "border-indigo-500 ring-2 ring-indigo-200 ring-offset-1 z-10" : "border-gray-300 hover:border-indigo-300"
                            )}
                            style={{ width: img.width }}
                            onClick={(e) => {
                                e.stopPropagation();
                                // Just select, don't necessarily seek inside unless dragged
                                onSeek(idx, 0); 
                            }}
                        >
                            {/* Thumbnail Strip */}
                            <div className="flex-1 relative overflow-hidden bg-gray-100 w-full">
                                {img.layers.length > 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-80">
                                         {/* Repeat background for visual texture */}
                                         <img src={img.thumbnail || img.layers[0].image.src} className="h-full w-full object-cover blur-[2px] opacity-50 scale-150 absolute" />
                                         <img src={img.thumbnail || img.layers[0].image.src} className="h-full object-contain relative z-10 shadow-sm" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 bg-gray-50 pattern-grid">Empty</div>
                                )}
                                
                                <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                    {idx + 1}
                                </div>
                            </div>

                            {/* Clip Controls (Only visible on large enough clips or hover) */}
                            <div className="h-7 bg-white border-t flex items-center justify-between px-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <input 
                                        type="number" 
                                        min="0.5" 
                                        max="60" 
                                        step="0.5"
                                        value={img.duration}
                                        onChange={(e) => handleDurationChange(e, img.id)}
                                        className="w-8 h-5 text-[10px] border border-transparent hover:border-gray-200 rounded text-center focus:ring-1 focus:ring-indigo-500"
                                        onMouseDown={e => e.stopPropagation()} // Prevent seek when editing time
                                    />
                                    <span className="text-[9px] text-gray-400">s</span>
                                </div>
                                <div className="flex items-center">
                                    {idx < clipMeta.length - 1 && (
                                        <div 
                                            className={cn("p-0.5 rounded", img.transition.type !== 'cut' ? "bg-indigo-50 text-indigo-600" : "text-gray-300")}
                                            title="Transition"
                                        >
                                            {img.transition.type === 'cut' ? <Zap className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hover Actions */}
                            <button
                                onClick={(e) => handleDelete(e, img.id)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-20"
                                onMouseDown={e => e.stopPropagation()}
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
             </div>

             {/* PLAYHEAD (Scrubber) */}
             <div 
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ 
                    left: playheadX,
                    transform: 'translateX(-50%)' // Center line on X
                }}
             >
                 {/* Head (Triangle) */}
                 <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 mx-auto drop-shadow-sm filter"></div>
                 {/* Line */}
                 <div className="w-[2px] h-full bg-red-500 mx-auto shadow-[0_0_4px_rgba(239,68,68,0.5)]"></div>
             </div>
             
          </div>
       </div>
    </div>
  );
};
