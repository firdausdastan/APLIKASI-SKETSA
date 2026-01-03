export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

export interface AnimationSettings {
  brushThickness: number;
  paperColor: string;
  showHand: boolean;
  handStyle: 'cartoon' | 'realistic';
  strokeSmoothness: number;
  drawingOrder: 'top-to-bottom' | 'random' | 'custom';
  edgeSensitivity: number;
  lineStyle: 'pencil' | 'marker' | 'pen';
}

export interface MarkerPoint {
  id: string;
  x: number;
  y: number;
  order: number;
}

export interface SegmentTiming {
  id: string;
  markerId: string;
  duration: number;
}

export interface CanvasExportData {
  drawAtProgress: (ctx: CanvasRenderingContext2D, progress: number) => void;
  dimensions: { width: number; height: number };
}

export interface ImageLayer {
  id: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface CameraTransition {
  type: 'cut' | 'pan';
  direction: 'left' | 'right' | 'up' | 'down';
  duration: number; // in seconds
}

export interface TimelineImage {
  id: string;
  layers: ImageLayer[];
  duration: number;
  order: number;
  thumbnail: string;
  transition: CameraTransition;
}

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  volume: number;
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
}