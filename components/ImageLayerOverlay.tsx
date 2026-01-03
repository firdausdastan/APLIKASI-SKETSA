import React, { useRef, useState, useEffect } from 'react';
import { ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types';
import { cn } from '@/lib/utils';

interface ImageLayerOverlayProps {
  layers: ImageLayer[];
  onLayersChange: (layers: ImageLayer[]) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  readOnly?: boolean;
}

export const ImageLayerOverlay: React.FC<ImageLayerOverlayProps> = ({
  layers,
  onLayersChange,
  selectedLayerId,
  onSelectLayer,
  containerRef,
  readOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'resize-se'>('move');
  const startPos = useRef({ x: 0, y: 0 });
  const startLayerState = useRef<ImageLayer | null>(null);

  // Calculate scale factor based on container size vs internal canvas size
  const getScale = () => {
    if (!containerRef.current) return 1;
    const rect = containerRef.current.getBoundingClientRect();
    return rect.width / CANVAS_WIDTH;
  };

  const handleMouseDown = (e: React.MouseEvent, layer: ImageLayer, mode: 'move' | 'resize-se') => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection/native drag
    onSelectLayer(layer.id);
    setIsDragging(true);
    setDragMode(mode);
    startPos.current = { x: e.clientX, y: e.clientY };
    startLayerState.current = { ...layer };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !startLayerState.current || !selectedLayerId) return;

    const scale = getScale();
    const dx = (e.clientX - startPos.current.x) / scale;
    const dy = (e.clientY - startPos.current.y) / scale;

    const newLayers = layers.map(l => {
      if (l.id === selectedLayerId) {
        if (dragMode === 'move') {
          return {
            ...l,
            x: startLayerState.current!.x + dx,
            y: startLayerState.current!.y + dy
          };
        } else if (dragMode === 'resize-se') {
          return {
            ...l,
            width: Math.max(20, startLayerState.current!.width + dx),
            height: Math.max(20, startLayerState.current!.height + dy)
          };
        }
      }
      return l;
    });

    onLayersChange(newLayers);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    startLayerState.current = null;
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, selectedLayerId]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {layers.map(layer => {
        const isSelected = layer.id === selectedLayerId;
        
        // We render using percentages to match the responsive canvas
        const left = (layer.x / CANVAS_WIDTH) * 100;
        const top = (layer.y / CANVAS_HEIGHT) * 100;
        const width = (layer.width / CANVAS_WIDTH) * 100;
        const height = (layer.height / CANVAS_HEIGHT) * 100;

        // Apply rotation but NOT scale. Flipping (scaleX/Y) happens inside the canvas drawing.
        // The bounding box for selection should just rotate.
        const transform = `rotate(${layer.rotation || 0}deg)`;

        return (
          <div
            key={layer.id}
            className={cn(
              "absolute group",
              !readOnly && "pointer-events-auto cursor-move"
            )}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              transform
            }}
            onMouseDown={(e) => handleMouseDown(e, layer, 'move')}
            onClick={(e) => e.stopPropagation()} // Prevent deselecting when clicking layer
          >
            {/* Visual Border */}
            <div className={cn(
              "w-full h-full border-2 transition-colors",
              isSelected ? "border-primary" : "border-transparent group-hover:border-primary/50"
            )} />

            {/* Resize Handle (Bottom Right) */}
            {isSelected && !readOnly && (
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-20 shadow-sm"
                onMouseDown={(e) => handleMouseDown(e, layer, 'resize-se')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
