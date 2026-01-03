import React, { useEffect, useRef } from 'react';
import { TimelineImage } from '@/types';
import { cn } from '@/lib/utils';
import { GripVertical, X, Layers } from 'lucide-react';

interface TimelineTrackProps {
  images: TimelineImage[];
  onImagesChange: (images: TimelineImage[]) => void;
  currentIndex: number;
  progress: number;
  onSeek: (index: number, progress: number) => void;
  isPlaying: boolean;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  images,
  onImagesChange,
  currentIndex,
  progress,
  onSeek,
}) => {
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onImagesChange(images.filter(img => img.id !== id));
  };

  // Helper to draw a mini composite for the thumbnail dynamically if needed, 
  // but for performance we rely on the cached thumbnail or just show the first layer
  // In a real app, we would update the `thumbnail` property in App.tsx whenever layers change.

  return (
    <div className="flex gap-2 overflow-x-auto h-full items-center pb-2 custom-scrollbar">
      {images.map((img, idx) => {
        const isActive = idx === currentIndex;
        const isPast = idx < currentIndex;
        
        return (
          <div 
            key={img.id}
            onClick={() => onSeek(idx, 0)}
            className={cn(
              "relative flex-shrink-0 h-24 w-32 rounded-lg border-2 overflow-hidden cursor-pointer group transition-all bg-gray-50",
              isActive ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-indigo-300",
              isPast ? "opacity-75" : "opacity-100"
            )}
          >
            {/* Thumbnail Display */}
            {img.layers.length > 0 ? (
               <div className="w-full h-full relative">
                  {/* Just showing the first layer as preview or the cached thumbnail */}
                  {img.thumbnail ? (
                      <img src={img.thumbnail} alt="frame" className="w-full h-full object-contain p-1" />
                  ) : (
                      <img src={img.layers[0].image.src} alt="layer" className="w-full h-full object-contain p-1" />
                  )}
                  
                  {img.layers.length > 1 && (
                     <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1 rounded flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {img.layers.length}
                     </div>
                  )}
               </div>
            ) : (
               <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">
                 Empty
               </div>
            )}
            
            {/* Overlay Progress for active item */}
            {isActive && (
              <div 
                className="absolute bottom-0 left-0 h-1 bg-indigo-500 z-10 transition-all duration-75"
                style={{ width: `${progress * 100}%` }}
              />
            )}
            
            <button
              onClick={(e) => handleDelete(e, img.id)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-sm z-20"
            >
              <X className="w-3 h-3" />
            </button>
            
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-gray-400 drop-shadow-md cursor-grab" />
            </div>
            
             <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
              {idx + 1}
            </div>
          </div>
        );
      })}
      
      {images.length === 0 && (
         <div className="flex flex-col items-center justify-center w-full h-full text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            <span>Empty Timeline</span>
         </div>
      )}
    </div>
  );
};
