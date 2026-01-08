
import React, { useRef, useState, useEffect } from 'react';
import { ImageLayer, CANVAS_WIDTH, CANVAS_HEIGHT, CameraState } from '@/types';
import { cn } from '@/lib/utils';
import { MoveUp, MoveDown } from 'lucide-react';

interface ImageLayerOverlayProps {
  layers: ImageLayer[];
  onLayersChange: (layers: ImageLayer[]) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  readOnly?: boolean;
  camera: CameraState;
  onReorder?: (direction: 'up' | 'down') => void;
}

export const ImageLayerOverlay: React.FC<ImageLayerOverlayProps> = ({
  layers,
  onLayersChange,
  selectedLayerId,
  onSelectLayer,
  containerRef,
  readOnly = false,
  camera,
  onReorder,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<'layer' | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-se'>('move');
  
  const startPos = useRef({ x: 0, y: 0 });
  const startLayerState = useRef<ImageLayer | null>(null);

  // Calculate base scale factor (responsive canvas size)
  const getScale = () => {
    if (!containerRef.current) return 1;
    const rect = containerRef.current.getBoundingClientRect();
    return rect.width / CANVAS_WIDTH;
  };

  const handleMouseDown = (e: React.MouseEvent, layer: ImageLayer, mode: 'move' | 'resize-se' = 'move') => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault(); 
    
    onSelectLayer(layer.id);
    setIsDragging(true);
    setDragTarget('layer');
    setDragMode(mode);
    
    startPos.current = { x: e.clientX, y: e.clientY };
    startLayerState.current = { ...layer };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !startLayerState.current || !selectedLayerId) return;

    const baseScale = getScale();
    const effectiveZoom = camera.zoom * baseScale;
    
    const dx = (e.clientX - startPos.current.x) / effectiveZoom;
    const dy = (e.clientY - startPos.current.y) / effectiveZoom;

    const newLayers = layers.map(l => {
      if (l.id === selectedLayerId) {
        if (dragTarget === 'layer') {
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
      }
      return l;
    });

    onLayersChange(newLayers);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragTarget(null);
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
  }, [isDragging, dragTarget, dragMode, selectedLayerId, camera]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <div 
        className="w-full h-full"
        style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: '0 0'
        }}
      >
      {layers.map(layer => {
        const isSelected = layer.id === selectedLayerId;
        
        // --- Object Rendering ---
        const left = (layer.x / CANVAS_WIDTH) * 100;
        const top = (layer.y / CANVAS_HEIGHT) * 100;
        const width = (layer.width / CANVAS_WIDTH) * 100;
        const height = (layer.height / CANVAS_HEIGHT) * 100;
        // Include scale in transform to match drawing
        const transform = `rotate(${layer.rotation || 0}deg) scale(${layer.scaleX || 1}, ${layer.scaleY || 1})`;

        return (
          <React.Fragment key={layer.id}>
              {/* Object Box */}
              <div
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
                onClick={(e) => e.stopPropagation()} 
              >
                {/* Visual Border */}
                <div className={cn(
                  "w-full h-full border-2 transition-colors",
                  isSelected ? "border-primary" : "border-transparent group-hover:border-primary/50"
                )} />

                {/* Layer Menu (Bring to Front / Send to Back) */}
                {isSelected && !readOnly && (
                   <div 
                      className="absolute -top-12 left-1/2 flex items-center gap-1 bg-white shadow-lg border rounded-lg p-1 z-50 pointer-events-auto"
                      style={{ 
                          // Counter-transform to keep menu upright and constant size regardless of object rotation/scale
                          transform: `translate(-50%, 0) rotate(${-(layer.rotation || 0)}deg) scale(${1 / (Math.abs(layer.scaleX || 1) * camera.zoom)}, ${1 / (Math.abs(layer.scaleY || 1) * camera.zoom)})`,
                          transformOrigin: 'bottom center' 
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                   >
                       <button 
                         onClick={(e) => { e.stopPropagation(); onReorder?.('up'); }} 
                         className="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" 
                         title="Bring to Front"
                       >
                          <MoveUp className="w-4 h-4" />
                       </button>
                       <div className="w-px h-4 bg-gray-200" />
                       <button 
                         onClick={(e) => { e.stopPropagation(); onReorder?.('down'); }} 
                         className="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" 
                         title="Send to Back"
                       >
                          <MoveDown className="w-4 h-4" />
                       </button>
                   </div>
                )}

                {/* Resize Handle for Object */}
                {isSelected && !readOnly && (
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-20 shadow-sm"
                    onMouseDown={(e) => handleMouseDown(e, layer, 'resize-se')}
                    style={{
                        transform: `scale(${1/camera.zoom})` 
                    }}
                  />
                )}
              </div>
          </React.Fragment>
        );
      })}
      </div>
    </div>
  );
};
