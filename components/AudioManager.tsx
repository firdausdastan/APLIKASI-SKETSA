import React, { useEffect, useRef } from 'react';
import { AudioTrack } from '@/types';
import { Volume2, VolumeX, Trash2 } from 'lucide-react';

interface AudioManagerProps {
  tracks: AudioTrack[];
  onTracksChange: (tracks: AudioTrack[]) => void;
  isPlaying: boolean;
  progress: number;
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  tracks,
  onTracksChange,
  isPlaying,
  progress,
}) => {
  // Simple audio playback management
  // In a real app, this would need complex syncing with global timeline
  const audioRefs = useRef<{[key: string]: HTMLAudioElement}>({});

  useEffect(() => {
    tracks.forEach(track => {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio(track.url);
        audio.volume = track.volume;
        audioRefs.current[track.id] = audio;
      }
    });

    // Cleanup removed tracks
    Object.keys(audioRefs.current).forEach(id => {
      if (!tracks.find(t => t.id === id)) {
        audioRefs.current[id].pause();
        delete audioRefs.current[id];
      }
    });
  }, [tracks]);

  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio: HTMLAudioElement) => {
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
  }, [isPlaying]);

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
                   if (audioRefs.current[track.id]) audioRefs.current[track.id].volume = vol;
                 }}
                 className="flex-1"
               />
             </div>
           </div>
         ))}
       </div>
    </div>
  );
};