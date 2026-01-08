
import React, { useState, useEffect, useRef } from 'react';
import { AnimationSettings, TimelineImage, AudioTrack } from '@/types';
import { Download, Loader2, X, Video, Monitor, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportDialogProps {
  timeline: TimelineImage[];
  audioTracks?: AudioTrack[];
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isPlaying: boolean;
  onStartPlayback: () => void;
  onStopPlayback: () => void;
  onSeek: (index: number, progress: number) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ 
  timeline,
  audioTracks = [],
  canvasRef,
  isPlaying,
  onStartPlayback,
  onStopPlayback,
  onSeek
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Refs to access objects across renders/effects
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  const totalDuration = timeline.reduce((acc, img) => acc + img.duration, 0);

  // Monitor playback state to stop recording when finished
  useEffect(() => {
    // If we are exporting, have started, and playback stops -> Stop Recording
    if (isExporting && hasStarted && !isPlaying) {
       if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
           mediaRecorderRef.current.stop();
       }
    }

    // Mark as started when playback actually begins
    if (isExporting && isPlaying) {
        setHasStarted(true);
    }
  }, [isPlaying, isExporting, hasStarted]);

  // Cleanup on unmount or close
  useEffect(() => {
      if (!isOpen) {
          setIsExporting(false);
          setHasStarted(false);
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      }
  }, [isOpen]);

  const handleExport = async () => {
    if (!canvasRef.current) {
        toast.error("Canvas source not found.");
        return;
    }

    setIsExporting(true);
    setHasStarted(false);
    setRecordingTime(0);

    // 1. Setup Audio Mixing
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Resume audio context if suspended
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    // Load and schedule audio tracks
    if (audioTracks.length > 0) {
        try {
            await Promise.all(audioTracks.map(async (track) => {
                const response = await fetch(track.url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = track.volume;
                
                source.connect(gainNode);
                gainNode.connect(dest);
                source.start(0); 
            }));
        } catch (e) {
            console.error("Audio mix error", e);
        }
    } else {
        // Dummy oscillator to keep audio track active
        const osc = audioCtx.createOscillator();
        osc.connect(dest);
        osc.frequency.setValueAtTime(0, audioCtx.currentTime);
        osc.start();
    }

    // 2. Setup Video Stream from Canvas
    const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
    
    // 3. Combine Streams
    const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
    ];
    const mixedStream = new MediaStream(combinedTracks);

    // 4. Setup Recorder
    const mimeTypes = [
        'video/mp4;codecs=avc1.4d402a', 
        'video/webm;codecs=vp9', 
        'video/webm'
    ];
    let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
    
    if (!selectedMime) {
        toast.error("Video export not supported by this browser.");
        setIsExporting(false);
        return;
    }

    const recorder = new MediaRecorder(mixedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 8000000 // 8 Mbps
    });
    
    mediaRecorderRef.current = recorder;

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sketch_Full_Timeline_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        // Cleanup Resources
        audioCtx.close();
        canvasStream.getTracks().forEach(t => t.stop());
        if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
        
        setIsExporting(false);
        setIsOpen(false);
        toast.success("Download Complete!");
        
        // Ensure playback is stopped in app
        onStopPlayback();
    };

    // 5. Start Process sequence
    // First, seek to beginning
    onSeek(0, 0);
    
    // Wait for canvas repaint, then start
    setTimeout(() => {
        try {
            recorder.start();
            onStartPlayback(); // This triggers isPlaying=true, which we watch in useEffect
            
            // Visual timer only (does not control stopping anymore)
            startTimeRef.current = Date.now();
            timerIntervalRef.current = window.setInterval(() => {
                setRecordingTime((Date.now() - startTimeRef.current) / 1000);
            }, 100);
            
        } catch (err) {
            console.error(err);
            toast.error("Failed to start recording");
            setIsExporting(false);
        }
    }, 800);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        disabled={timeline.length === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100"
      >
        <Download className="w-4 h-4" />
        <span className="text-sm font-medium">Download Video</span>
      </button>
    );
  }

  return (
    <div className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300",
        isExporting ? "opacity-0 pointer-events-none" : "opacity-100"
    )}>
      {/* If exporting, show a tiny floating status */}
      {isExporting && (
          <div className="fixed bottom-8 right-8 bg-black/80 text-white px-6 py-4 rounded-xl shadow-2xl z-[200] flex items-center gap-4 pointer-events-auto opacity-100">
             <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
             <div>
                <div className="font-bold text-sm">Recording Scene...</div>
                <div className="text-xs text-gray-400 font-mono">
                    {formatTime(recordingTime)} / {formatTime(totalDuration)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    Waiting for animation to finish...
                </div>
             </div>
          </div>
      )}

      <div className={cn(
          "bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl border border-gray-100 transform transition-all scale-100",
          isExporting ? "hidden" : "block"
      )}>
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-none">Export Video</h3>
                <p className="text-xs text-gray-500 mt-1">Full Timeline Render</p>
              </div>
           </div>
           <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
             <X className="w-5 h-5 text-gray-400" />
           </button>
        </div>

        <div className="space-y-5">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-indigo-900 uppercase">Total Duration</span>
                    <span className="text-lg font-bold text-indigo-600">{formatTime(totalDuration)}</span>
                </div>
                <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-full" />
                </div>
                <p className="text-[10px] text-indigo-700 mt-2 leading-relaxed">
                    This will play your animation from start to finish. The download will start automatically when the animation completes.
                </p>
            </div>

            <button 
                onClick={handleExport}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <Monitor className="w-4 h-4" />
                Start Recording & Download
            </button>
            
            <p className="text-[10px] text-center text-gray-400">
                Please do not switch tabs during recording.
            </p>
        </div>
      </div>
    </div>
  );
};
