import { Floor } from '../../api';

// 3D Layout Constants
export const POD_RADIUS = 0.75;
export const POD_HEIGHT = POD_RADIUS * 0.8 * 2;  // 1.2 - matches diameter for 1:1 ratio
export const FLOOR_SPACING = POD_HEIGHT * 1.35;  // brings next floor closer to pod roof
export const FLOOR_RADIUS_SCALE = 2.0; // reduced platform diameter
export const TOWER_GAP = 3;
export const INITIAL_CAMERA_POSITION: Vec3 = [0, 5, 15];

// Types
export type Vec3 = [number, number, number];
export type TowerPosition = { x: number; z: number };
export type Axial = { q: number; r: number };

// Utility: Generate hexagonal spiral coordinates
export function generateHexSpiralCoords(count: number): Axial[] {
  if (count <= 0) return [];

  const coords: Axial[] = [{ q: 0, r: 0 }]; // Center at index 0
  if (count === 1) return coords;

  // Directions for walking AROUND a hex ring (not outward from center)
  // Starting at (k, 0) and walking counter-clockwise
  const dirs: Axial[] = [
    { q: 0, r: -1 },   // NW
    { q: -1, r: 0 },   // W
    { q: -1, r: 1 },   // SW
    { q: 0, r: 1 },    // SE
    { q: 1, r: 0 },    // E
    { q: 1, r: -1 },   // NE
  ];

  for (let k = 1; coords.length < count; k++) {
    // Start at corner (k, 0) then walk the hex ring
    let q = k;
    let r = 0;
    for (let side = 0; side < 6 && coords.length < count; side++) {
      const dir = dirs[side];
      for (let step = 0; step < k && coords.length < count; step++) {
        coords.push({ q, r });
        q += dir.q;
        r += dir.r;
      }
    }
  }

  return coords.slice(0, count);
}

// Calculate max ring radius for a Tower
export function getTowerMaxRadius(floors: Floor[]): number {
  let maxRadius = 1;
  for (const floor of floors) {
    for (const ring of floor.rings || []) {
      maxRadius = Math.max(maxRadius, ring.radiusIndex + 1);
    }
  }
  return maxRadius;
}
