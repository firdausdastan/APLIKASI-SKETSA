import React, { useRef, useState, useEffect } from 'react';
import { TextElement, CameraState, CANVAS_WIDTH } from '@/types';
import { cn } from '@/lib/utils';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Trash2 } from 'lucide-react';

interface TextOverlayProps {
  elements: TextElement[];
  onElementsChange: (elements: TextElement[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  camera: CameraState;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  elements,
  onElementsChange,
  selectedId,
  onSelect,
  containerRef,
  camera,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const getScale = () => {
    if (!containerRef.current) return 1;
    const rect = containerRef.current.getBoundingClientRect();
    return rect.width / CANVAS_WIDTH;
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelect(id);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !selectedId || !containerRef.current) return;

    const baseScale = getScale();
    const effectiveZoom = camera.zoom * baseScale;

    const dx = (e.clientX - dragStart.current.x) / effectiveZoom;
    const dy = (e.clientY - dragStart.current.y) / effectiveZoom;
    
    onElementsChange(elements.map(el => {
      if (el.id === selectedId) {
        return { ...el, x: el.x + dx, y: el.y + dy };
      }
      return el;
    }));

    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
  }, [isDragging, selectedId, camera]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div 
        className="w-full h-full relative"
        style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: '0 0'
        }}
      >
      {elements.map(el => (
        <div
          key={el.id}
          className={cn(
            "absolute pointer-events-auto cursor-move select-none p-2 border-2",
            selectedId === el.id ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/30"
          )}
          style={{
            transform: `translate(${el.x}px, ${el.y}px)`,
            fontSize: `${el.fontSize}px`,
            fontFamily: el.fontFamily,
            color: el.color,
            fontWeight: el.bold ? 'bold' : 'normal',
            fontStyle: el.italic ? 'italic' : 'normal',
            textAlign: el.align,
            minWidth: '50px'
          }}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
          onDoubleClick={(e) => {
             e.stopPropagation();
             const newText = prompt("Edit Text", el.text);
             if(newText !== null) {
                onElementsChange(elements.map(t => t.id === el.id ? {...t, text: newText} : t));
             }
          }}
        >
          {el.text}
          {selectedId === el.id && (
             <div 
                className="absolute -top-3 -right-3 w-6 h-6 bg-white border border-primary rounded-full" 
                style={{ transform: `scale(${1/camera.zoom})` }}
             />
          )}
        </div>
      ))}
      </div>
    </div>
  );
};

export const TextEditorPanel: React.FC<{ element: TextElement; onUpdate: (updates: Partial<TextElement>) => void }> = ({ element, onUpdate }) => {
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between">
         <h4 className="text-xs font-semibold uppercase text-muted-foreground">Text Properties</h4>
         <button onClick={() => {
             onUpdate({ text: '' }); // Hacky delete
         }}>
            <Trash2 className="w-4 h-4 text-destructive" />
         </button>
       </div>
       
       <div className="space-y-2">
         <label className="text-xs">Content</label>
         <input 
           className="w-full text-sm p-2 border rounded bg-background"
           value={element.text}
           onChange={(e) => onUpdate({ text: e.target.value })}
         />
       </div>

       <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs block mb-1">Size</label>
            <input 
              type="number" 
              className="w-full text-sm p-1 border rounded bg-background"
              value={element.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs block mb-1">Color</label>
             <input 
              type="color" 
              className="w-full h-8 border rounded bg-background"
              value={element.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
            />
          </div>
       </div>

       <div className="flex gap-2 p-1 bg-secondary rounded-lg">
          <button 
             className={cn("flex-1 p-1 rounded hover:bg-white", element.bold && "bg-white shadow-sm")}
             onClick={() => onUpdate({ bold: !element.bold })}
          >
             <Bold className="w-4 h-4 mx-auto" />
          </button>
          <button 
             className={cn("flex-1 p-1 rounded hover:bg-white", element.italic && "bg-white shadow-sm")}
             onClick={() => onUpdate({ italic: !element.italic })}
          >
             <Italic className="w-4 h-4 mx-auto" />
          </button>
          <div className="w-px bg-border mx-1" />
          <button 
             className={cn("flex-1 p-1 rounded hover:bg-white", element.align === 'left' && "bg-white shadow-sm")}
             onClick={() => onUpdate({ align: 'left' })}
          >
             <AlignLeft className="w-4 h-4 mx-auto" />
          </button>
           <button 
             className={cn("flex-1 p-1 rounded hover:bg-white", element.align === 'center' && "bg-white shadow-sm")}
             onClick={() => onUpdate({ align: 'center' })}
          >
             <AlignCenter className="w-4 h-4 mx-auto" />
          </button>
           <button 
             className={cn("flex-1 p-1 rounded hover:bg-white", element.align === 'right' && "bg-white shadow-sm")}
             onClick={() => onUpdate({ align: 'right' })}
          >
             <AlignRight className="w-4 h-4 mx-auto" />
          </button>
       </div>
    </div>
  );
};