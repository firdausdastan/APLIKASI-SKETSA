import React from 'react';
import { MarkerPoint } from '@/types';

interface SequenceMarkerProps {
  image: HTMLImageElement;
  markers: MarkerPoint[];
  onMarkersChange: (markers: MarkerPoint[]) => void;
  isEditMode: boolean;
  onEditModeChange: (mode: boolean) => void;
}

export const SequenceMarker: React.FC<SequenceMarkerProps> = ({
  isEditMode,
  onEditModeChange
}) => {
  return (
    <div className="bg-secondary/30 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Path Editor</h4>
        <button 
          onClick={() => onEditModeChange(!isEditMode)}
          className={`text-xs px-2 py-1 rounded border ${isEditMode ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
        >
          {isEditMode ? 'Done' : 'Edit Path'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isEditMode ? 'Click on canvas to add points (Not implemented in this demo)' : 'Switch to Edit Path to customize stroke order.'}
      </p>
    </div>
  );
};
