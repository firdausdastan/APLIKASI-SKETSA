
import React, { useEffect, useRef } from 'react';
import { AudioTrack } from '@/types';
import { Volume2, VolumeX, Trash2 } from 'lucide-react';

interface AudioManagerProps {
  tracks: AudioTrack[];
  onTracksChange: (tracks: AudioTrack[]) => void;
  isPlaying: boolean;
  currentTime: number;
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  tracks,
  onTracksChange,
  isPlaying,
  currentTime,
}) => {
  // Simple audio playback management
  const audioRefs = useRef<{[key: string]: HTMLAudioElement}>({});

  useEffect(() => {
    tracks.forEach(track => {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio(track.url);
        audio.volume = track.volume;
        // Preload to ensure availability
        audio.preload = 'auto';
        audioRefs.current[track.id] = audio;
      } else {
        // Update volume if changed
        if (audioRefs.current[track.id].volume !== track.volume) {
           audioRefs.current[track.id].volume = track.volume;
        }
      }
    });

    // Cleanup removed tracks
    Object.keys(audioRefs.current).forEach(id => {
      if (!tracks.find(t => t.id === id)) {
        const audio = audioRefs.current[id];
        if (!audio.paused) audio.pause();
        audio.src = "";
        delete audioRefs.current[id];
      }
    });
  }, [tracks]);

  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      const audioElement = audio as HTMLAudioElement; // Explicit cast

      // Sync Time (Drift Correction)
      // We use a larger threshold (0.5s) to prevent "fighting" between the JS frame loop and audio clock.
      // If visual lags slightly (common in heavy canvas apps), we prefer audio to continue smoothly 
      // rather than stuttering by constantly seeking back.
      const diff = audioElement.currentTime - currentTime;
      
      // If difference is large (> 0.5s), it's likely a seek or severe lag -> Sync immediately
      if (Math.abs(diff) > 0.5) {
         if (Number.isFinite(currentTime)) {
             audioElement.currentTime = currentTime;
         }
      }

      // Sync Play/Pause State
      if (isPlaying) {
         // Only try to play if paused and not at the end
         if (audioElement.paused && audioElement.currentTime < audioElement.duration) {
             const playPromise = audioElement.play();
             if (playPromise !== undefined) {
                 playPromise.catch(e => {
                     // Auto-play policy or interrupted request errors are common here
                     // We log them but don't crash
                     console.warn("Audio play prevented:", e);
                 });
             }
         }
      } else {
         if (!audioElement.paused) {
             audioElement.pause();
         }
      }
    });
  }, [isPlaying, currentTime, tracks]); // Tracks dependency ensures we handle list updates

  // Handle unmount
  useEffect(() => {
      return () => {
          Object.values(audioRefs.current).forEach((audio) => {
              const el = audio as HTMLAudioElement;
              if (!el.paused) el.pause();
          });
      };
  }, []);

  return (
    <div className="space-y-4">
       <h4 className="text-xs font-semibold uppercase text-muted-foreground">Audio Tracks</h4>
       <div className="space-y-2">
         {tracks.map(track => (
           <div key={track.id} className="bg-background border rounded-lg p-3">
             <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate w-32">{track.name}</span>
                <button 
                  onClick={() => onTracksChange(tracks.filter(t => t.id !== track.id))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
             
             <div className="flex items-center gap-2">
               {track.volume === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
               <input 
                 type="range"
                 min="0"
                 max="1"
                 step="0.1"
                 value={track.volume}
                 onChange={(e) => {
                   const vol = Number(e.target.value);
                   onTracksChange(tracks.map(t => t.id === track.id ? {...t, volume: vol} : t));
                 }}
                 className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
               />
             </div>
           </div>
         ))}
         {tracks.length === 0 && (
             <div className="text-[10px] text-gray-400 text-center italic py-2">No audio tracks added</div>
         )}
       </div>
    </div>
  );
};
