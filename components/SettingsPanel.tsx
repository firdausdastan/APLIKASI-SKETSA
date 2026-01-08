
import React, { useState } from 'react';
import { AnimationSettings } from '@/types';
import { Sliders, ChevronDown, ChevronRight, PenTool, Play, Gauge, ScrollText, Layers, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  settings: AnimationSettings;
  onSettingsChange: (s: AnimationSettings) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SettingsGroup = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ElementType; 
  children?: React.ReactNode; 
  defaultOpen?: boolean; 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white/50 shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-gray-700">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-3 space-y-4 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onSettingsChange,
  speed,
  onSpeedChange
}) => {
  const handleChange = <K extends keyof AnimationSettings>(key: K, value: AnimationSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Sliders className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Configuration</h3>
      </div>

      {/* Group 1: Style & Tools */}
      <SettingsGroup title="Style & Canvas" icon={PenTool} defaultOpen={true}>
        
        {/* Stroke / Pencil Thickness */}
        <div className="pb-3 border-b border-gray-100">
            <div className="flex justify-between mb-1">
               <span className="text-xs font-medium text-gray-700">Pencil Thickness</span>
               <span className="text-xs font-bold text-gray-500">{settings.brushThickness}px</span>
            </div>
            <input 
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={settings.brushThickness}
              onChange={(e) => handleChange('brushThickness', Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        {/* Hand Style */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Hand Style</label>
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
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Show Hand Toggle */}
        <div className="flex items-center justify-between py-1">
          <label className="text-xs font-medium text-gray-700">Show Hand</label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
                type="checkbox" 
                checked={settings.showHand}
                onChange={(e) => handleChange('showHand', e.target.checked)}
                className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Paper Color & Vintage Palette */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block text-amber-900/60 font-serif italic">Vintage Faded Palette</label>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            {[
              { color: '#ffffff', name: 'Standard White' },
              { color: '#fdf6e3', name: 'Faded Sun' },
              { color: '#fcf5e5', name: 'Parchment' }, 
              { color: '#eee8d5', name: 'Solarized Base' }, 
              { color: '#e7dcb9', name: 'Old Letter' }, 
              { color: '#d1bc8a', name: 'Antique Kraft' },
              { color: '#c4b494', name: 'Sepia Dust' },
              { color: '#18181b', name: 'Chalkboard' }
            ].map(({ color, name }) => (
              <button
                key={color}
                className={cn(
                    "w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-125",
                    settings.paperColor === color ? 'ring-2 ring-amber-500 ring-offset-2 scale-110' : 'border-gray-200'
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleChange('paperColor', color)}
                title={name}
              />
            ))}
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm hover:scale-125 transition-transform cursor-pointer" title="Custom Color">
                <input 
                type="color"
                value={settings.paperColor}
                onChange={(e) => handleChange('paperColor', e.target.value)}
                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 border-0 cursor-pointer"
                />
            </div>
          </div>
        </div>

        {/* Paper Texture Selection */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
           <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter flex items-center gap-1">
             <ScrollText className="w-3 h-3" /> Vintage Texture (Lecek)
           </label>
           <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'none', label: 'Polos' },
                { id: 'grainy', label: 'Serat' },
                { id: 'crumpled', label: 'Lecek' }
              ].map((tex) => (
                <button
                  key={tex.id}
                  onClick={() => handleChange('paperTexture', tex.id as any)}
                  className={cn(
                    "py-1 text-[10px] font-bold rounded-md border transition-all",
                    settings.paperTexture === tex.id
                      ? "bg-amber-100 text-amber-800 border-amber-300 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200"
                  )}
                >
                  {tex.label}
                </button>
              ))}
           </div>
           
           {settings.paperTexture !== 'none' && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-gray-400 font-medium">Texture Intensity</span>
                  <span className="text-[10px] font-bold text-amber-600">{Math.round(settings.textureIntensity * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.textureIntensity}
                  onChange={(e) => handleChange('textureIntensity', Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
           )}
        </div>
      </SettingsGroup>

      {/* Group 2: Animation */}
      <SettingsGroup title="Animation Flow" icon={Play}>
         {/* Animation Speed */}
         <div className="pb-3 border-b border-gray-100">
            <div className="flex justify-between mb-1">
               <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                 <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                 Animation Speed
               </div>
               <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{speed}x</span>
            </div>
            <input 
              type="range"
              min="0.25"
              max="3.0"
              step="0.25"
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
         </div>

         {/* Drawing Order */}
        <div className="pt-2">
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Drawing Order</label>
          <select 
            className="w-full text-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={settings.drawingOrder}
            onChange={(e) => handleChange('drawingOrder', e.target.value as any)}
          >
            <option value="top-to-bottom">Top to Bottom (Standard)</option>
            <option value="smart-flow">Smart Flow (Optimized)</option>
            <option value="random">Random</option>
          </select>
        </div>
        
        {/* Edge Sensitivity */}
        <div className="pt-2 border-t border-gray-100 mt-2">
            <div className="flex justify-between mb-1">
               <span className="text-xs font-medium text-gray-700">Edge Detection Sensitivity</span>
               <span className="text-xs font-bold text-gray-500">{Math.round(settings.edgeSensitivity * 100)}%</span>
            </div>
            <input 
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              value={settings.edgeSensitivity}
              onChange={(e) => handleChange('edgeSensitivity', Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </SettingsGroup>
    </div>
  );
};
