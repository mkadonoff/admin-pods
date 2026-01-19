/**
 * Pod-Centric 3D Navigation Types
 * 
 * This module defines types for the pod-based navigation system where users
 * experience the 3D environment from within a hexagonal pod vehicle.
 */

export type Vec3 = [number, number, number];

/** Axial hex coordinates (pointy-top orientation) */
export type Axial = { q: number; r: number };

/** 6 directions for hex neighbor calculation */
export const HEX_DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },    // East (0°)
  { q: 1, r: -1 },   // NE (60°)
  { q: 0, r: -1 },   // NW (120°)
  { q: -1, r: 0 },   // West (180°)
  { q: -1, r: 1 },   // SW (240°)
  { q: 0, r: 1 },    // SE (300°)
];

/** Vertical movement state */
export type VerticalMode = 'grounded' | 'ascending' | 'descending' | 'ejected';

/** Camera slot positions: 0 = center, 1-6 = facing each hex face */
export type CameraSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Camera height levels: 0 = floor, 4 = ceiling */
export type CameraHeight = 0 | 1 | 2 | 3 | 4;

/** Speed increments: 0 = stopped, 5 = fastest */
export type SpeedLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Speed values in units per second for each level */
export const SPEED_VALUES: Record<SpeedLevel, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 10,
};

/** Road segment connecting two tower bases */
export interface RoadSegment {
  id: string;
  fromTowerId: number;
  toTowerId: number;
  fromAxial: Axial;
  toAxial: Axial;
  fromWorld: Vec3;  // World position at Y=0
  toWorld: Vec3;    // World position at Y=0
}

/** Tower boundary zone for ascension detection */
export interface TowerBoundary {
  towerId: number;
  axial: Axial;
  center: Vec3;     // World center at Y=0
  radius: number;   // Boundary cylinder radius
  maxFloorY: number; // Height of top floor
}

/** Tower info with positioning */
export interface TowerWithPosition {
  towerId: number;
  axial: Axial;
  worldPos: Vec3;
  radius: number;
  maxFloorY: number;
  floorCount: number;
}

/** Complete navigation state for the pod vehicle */
export interface NavigationState {
  /** Whether pod navigation mode is active */
  active: boolean;
  
  /** Current pod world position */
  position: Vec3;
  
  /** Pod rotation in 60° increments (0-5 maps to 0°, 60°, 120°, 180°, 240°, 300°) */
  podRotation: 0 | 1 | 2 | 3 | 4 | 5;
  
  /** Camera position slot within pod (0 = center, 1-6 = faces) */
  cameraSlot: CameraSlot;
  
  /** Camera height level (0-4, evenly spaced floor to ceiling) */
  cameraHeight: CameraHeight;
  
  /** Camera pan angle in degrees (0-359) */
  cameraPan: number;
  
  /** Camera tilt angle in degrees (0-180, 90 = level) */
  cameraTilt: number;
  
  /** Current movement speed level */
  speed: SpeedLevel;
  
  /** Movement direction in radians (based on podRotation) */
  movementDirection: number;
  
  /** Vertical movement mode */
  verticalMode: VerticalMode;
  
  /** Current floor index when in tower (0-based) */
  currentFloor: number;
  
  /** Tower ID when inside a tower boundary, null when on road */
  inTowerId: number | null;
  
  /** Current road segment when on road, null when in tower */
  currentRoad: RoadSegment | null;
  
  /** Progress along current road (0-1) */
  roadProgress: number;
  
  /** Ejection animation progress (0-1) when verticalMode is 'ejected' */
  ejectionProgress: number;
  
  /** Ejection start and end positions */
  ejectionStart: Vec3 | null;
  ejectionEnd: Vec3 | null;
  
  /** Peak height for parabolic ejection arc */
  ejectionPeakHeight: number;
}

/** Default/initial navigation state */
export const DEFAULT_NAVIGATION_STATE: NavigationState = {
  active: false,
  position: [0, 0, 0],
  podRotation: 0,
  cameraSlot: 0,
  cameraHeight: 2,  // Middle height
  cameraPan: 0,
  cameraTilt: 90,   // Level (looking forward)
  speed: 0,
  movementDirection: 0,
  verticalMode: 'grounded',
  currentFloor: 0,
  inTowerId: null,
  currentRoad: null,
  roadProgress: 0,
  ejectionProgress: 0,
  ejectionStart: null,
  ejectionEnd: null,
  ejectionPeakHeight: 15,
};

/** Keyboard action types for pod navigation */
export type NavAction =
  | 'toggle-nav'
  | 'exit-nav'
  | 'speed-up'
  | 'speed-down'
  | 'rotate-left'
  | 'rotate-right'
  | 'pan-left'
  | 'pan-right'
  | 'pan-left-fine'
  | 'pan-right-fine'
  | 'tilt-up'
  | 'tilt-down'
  | 'ascend'
  | 'descend'
  | 'camera-slot-1'
  | 'camera-slot-2'
  | 'camera-slot-3'
  | 'camera-slot-4'
  | 'camera-slot-5'
  | 'camera-slot-6'
  | 'camera-slot-7'
  | 'height-up'
  | 'height-down'
  | 'reset-camera';

/** Key bindings for pod navigation */
export const NAV_KEY_BINDINGS: Record<string, NavAction> = {
  'n': 'toggle-nav',
  'N': 'toggle-nav',
  'Escape': 'exit-nav',
  'w': 'speed-up',
  'W': 'speed-up',
  's': 'speed-down',
  'S': 'speed-down',
  'a': 'rotate-right',
  'A': 'rotate-right',
  'd': 'rotate-left',
  'D': 'rotate-left',
  'q': 'pan-left',
  'Q': 'pan-left',
  'e': 'pan-right',
  'E': 'pan-right',
  'ArrowLeft': 'pan-left-fine',
  'ArrowRight': 'pan-right-fine',
  'ArrowUp': 'tilt-up',
  'ArrowDown': 'tilt-down',
  'r': 'ascend',
  'R': 'ascend',
  'f': 'descend',
  'F': 'descend',
  '1': 'camera-slot-1',
  '2': 'camera-slot-2',
  '3': 'camera-slot-3',
  '4': 'camera-slot-4',
  '5': 'camera-slot-5',
  '6': 'camera-slot-6',
  '7': 'camera-slot-7',
  'z': 'height-down',
  'Z': 'height-down',
  'x': 'height-up',
  'X': 'height-up',
  '0': 'reset-camera',
};

/** Utility: Get neighbors of an axial coordinate */
export function getAxialNeighbors(coord: Axial): Axial[] {
  return HEX_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/** Utility: Create unique key from axial coordinate */
export function axialKey(coord: Axial): string {
  return `${coord.q},${coord.r}`;
}

/** Utility: Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Utility: Lerp Vec3 */
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Utility: Parabolic interpolation for ejection arc */
export function parabolicLerp(from: Vec3, to: Vec3, t: number, peakHeight: number): Vec3 {
  const linear = lerpVec3(from, to, t);
  // Parabolic arc: 4 * h * t * (1 - t) peaks at t=0.5 with height h
  const arcY = 4 * peakHeight * t * (1 - t);
  return [linear[0], linear[1] + arcY, linear[2]];
}

/** Utility: Distance between two Vec3 */
export function distanceVec3(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Utility: Distance on XZ plane (ignoring Y) */
export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dz * dz);
}
