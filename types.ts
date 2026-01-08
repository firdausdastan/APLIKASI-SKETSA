

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export interface AnimationSettings {
  brushThickness: number;
  paperColor: string;
  paperTexture: 'none' | 'grainy' | 'crumpled';
  textureIntensity: number;
  showHand: boolean;
  handStyle: 'cartoon' | 'realistic';
  strokeSmoothness: number;
  drawingOrder: 'top-to-bottom' | 'random' | 'custom' | 'smart-flow';
  edgeSensitivity: number;
  lineStyle: 'pencil' | 'marker' | 'pen';
  autoCamera?: boolean;
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

export interface LayerFraming {
  scale: number; // 1.0 = default auto-fit
  offsetX: number; // Offset from object center
  offsetY: number;
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
  opacity: number;
  framing?: LayerFraming;
}

export interface CameraTransition {
  type: 'cut' | 'pan' | 'fade' | 'zoom' | 'paper-slide';
  direction: 'left' | 'right' | 'up' | 'down';
  duration: number; // in seconds
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface TimelineImage {
  id: string;
  layers: ImageLayer[];
  duration: number;
  order: number;
  thumbnail: string;
  transition: CameraTransition;
  camera: CameraState;
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
  framing?: LayerFraming;
}