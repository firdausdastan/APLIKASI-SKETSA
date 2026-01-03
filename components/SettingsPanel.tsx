import React from 'react';
import { AnimationSettings } from '@/types';
import { Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  settings: AnimationSettings;
  onSettingsChange: (s: AnimationSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange }) => {
  const handleChange = <K extends keyof AnimationSettings>(key: K, value: AnimationSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Sliders className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Animation Settings</h3>
      </div>

      <div className="space-y-4">
        {/* Hand Style */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Hand Style</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'cartoon', label: 'Cartoon' },
              { id: 'realistic', label: 'Realistic' }
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => handleChange('handStyle', style.id as any)}
                className={cn(
                  "px-2 py-2 text-xs font-medium rounded-md border transition-all",
                  settings.handStyle === style.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-input hover:border-primary/50 hover:bg-secondary/50"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Line Style */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Line Style</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'pencil', label: 'Pencil' },
              { id: 'marker', label: 'Marker' },
              { id: 'pen', label: 'Pen' }
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => handleChange('lineStyle', style.id as any)}
                className={cn(
                  "px-2 py-2 text-xs font-medium rounded-md border transition-all",
                  settings.lineStyle === style.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-input hover:border-primary/50 hover:bg-secondary/50"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawing Order */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Drawing Order</label>
          <select 
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={settings.drawingOrder}
            onChange={(e) => handleChange('drawingOrder', e.target.value as any)}
          >
            <option value="top-to-bottom">Top to Bottom</option>
            <option value="random">Random Strokes</option>
            <option value="custom">Custom Sequence</option>
          </select>
        </div>

        {/* Show Hand Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Show Hand</label>
          <input 
            type="checkbox"
            checked={settings.showHand}
            onChange={(e) => handleChange('showHand', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>

        {/* Paper Color */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Paper Color</label>
          <div className="flex gap-2">
            {['#ffffff', '#f5f5f5', '#fff1e6', '#e0f2f1'].map(color => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full border ${settings.paperColor === color ? 'ring-2 ring-primary ring-offset-2' : 'border-gray-200'}`}
                style={{ backgroundColor: color }}
                onClick={() => handleChange('paperColor', color)}
              />
            ))}
            <input 
              type="color"
              value={settings.paperColor}
              onChange={(e) => handleChange('paperColor', e.target.value)}
              className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden"
            />
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-3">
           <div>
            <div className="flex justify-between mb-1">
               <label className="text-xs text-muted-foreground">Edge Sensitivity</label>
               <span className="text-xs font-medium">{Math.round(settings.edgeSensitivity * 100)}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.edgeSensitivity}
              onChange={(e) => handleChange('edgeSensitivity', Number(e.target.value))}
              className="w-full"
            />
          </div>

           <div>
            <div className="flex justify-between mb-1">
               <label className="text-xs text-muted-foreground">Stroke Smoothness</label>
               <span className="text-xs font-medium">{Math.round(settings.strokeSmoothness * 100)}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.strokeSmoothness}
              onChange={(e) => handleChange('strokeSmoothness', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
           <div>
            <div className="flex justify-between mb-1">
               <label className="text-xs text-muted-foreground">Brush Thickness</label>
               <span className="text-xs font-medium">{settings.brushThickness}px</span>
            </div>
            <input 
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={settings.brushThickness}
              onChange={(e) => handleChange('brushThickness', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};