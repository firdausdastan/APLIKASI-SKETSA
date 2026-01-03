import React, { useState } from 'react';
import { AnimationSettings } from '@/types';
import { Download, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportDialogProps {
  image: HTMLImageElement | undefined; // Kept for interface compatibility but not strictly used if using dimensions
  settings: AnimationSettings;
  drawFunction: (ctx: CanvasRenderingContext2D, progress: number) => void;
  dimensions: { width: number; height: number };
  disabled: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ 
  drawFunction, 
  dimensions,
  disabled 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    // Create an offscreen canvas for recording
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      toast.error("Could not create canvas context");
      setIsExporting(false);
      return;
    }

    // Optional: Draw background once
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    const stream = canvas.captureStream(30); // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sketch-animation-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      setIsOpen(false);
      toast.success("Video exported successfully!");
    };

    mediaRecorder.start();

    // Simulation loop
    const duration = 5000; // 5 seconds fixed for now
    const fps = 30;
    const totalFrames = (duration / 1000) * fps;
    let frame = 0;

    const renderFrame = () => {
      if (frame > totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const p = frame / totalFrames;
      setProgress(Math.round(p * 100));
      drawFunction(ctx, p);
      
      frame++;
      setTimeout(renderFrame, 1000 / fps);
    };

    renderFrame();
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">Export</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md p-6 rounded-xl shadow-xl border border-border">
        <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-semibold">Export Video</h3>
           {!isExporting && (
             <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
               <X className="w-5 h-5" />
             </button>
           )}
        </div>

        {isExporting ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
            <h4 className="text-sm font-medium mb-2">Rendering Video...</h4>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{progress}% Complete</p>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="text-sm font-medium mb-1">Format: WebM</div>
                <div className="text-xs text-muted-foreground">Standard web video format.</div>
             </div>
             
             <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="text-sm font-medium mb-1">Resolution</div>
                <div className="text-xs text-muted-foreground">{dimensions.width} x {dimensions.height}</div>
             </div>

             <button 
               onClick={handleExport}
               className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
             >
               Start Render
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
