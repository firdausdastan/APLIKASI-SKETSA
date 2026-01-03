import React from 'react';
import { MarkerPoint, SegmentTiming } from '@/types';

interface SegmentTimelineProps {
  markers: MarkerPoint[];
  segmentTimings: SegmentTiming[];
  onTimingsChange: (timings: SegmentTiming[]) => void;
}

export const SegmentTimeline: React.FC<SegmentTimelineProps> = () => {
  return (
    <div className="opacity-50 pointer-events-none">
       <div className="text-xs text-center">Timeline segments active when markers added.</div>
    </div>
  );
};
