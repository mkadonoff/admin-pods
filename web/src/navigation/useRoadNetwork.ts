/**
 * Road Network Hook
 * 
 * Computes implicit roads between adjacent towers based on hexagonal grid layout.
 * Roads connect tower bases at Y=0.
 */

import { useMemo } from 'react';
import {
  Axial,
  Vec3,
  RoadSegment,
  TowerBoundary,
  TowerWithPosition,
  HEX_DIRECTIONS,
  axialKey,
} from './PodNavigationTypes';
import { Tower, Floor } from '../api';

interface UseRoadNetworkProps {
  towers: Tower[];
  floors: Floor[];
  hexSize: number;
  floorRadiusScale: number;
  floorSpacing: number;
}

interface RoadNetworkResult {
  /** All road segments connecting adjacent towers */
  roads: RoadSegment[];
  /** Tower boundary zones for ascension detection */
  boundaries: TowerBoundary[];
  /** Towers with full position info */
  towersWithPosition: TowerWithPosition[];
}

/** Generate hex spiral coordinates (matches LayoutView) */
function generateHexSpiralCoords(count: number): Axial[] {
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

/** Convert axial to world coordinates (pointy-top) */
function axialToWorld(axial: Axial, hexSize: number): Vec3 {
  const x = hexSize * Math.sqrt(3) * (axial.q + axial.r / 2);
  const z = hexSize * (3 / 2) * axial.r;
  return [x, 0, z];
}

/** Calculate max ring radius for a tower */
function getTowerMaxRadius(floors: Floor[]): number {
  let maxRadius = 1;
  for (const floor of floors) {
    for (const ring of floor.rings || []) {
      maxRadius = Math.max(maxRadius, ring.radiusIndex + 1);
    }
  }
  return maxRadius;
}

export function useRoadNetwork({
  towers,
  floors,
  hexSize,
  floorRadiusScale,
  floorSpacing,
}: UseRoadNetworkProps): RoadNetworkResult {
  return useMemo(() => {
    if (towers.length === 0) {
      return { roads: [], boundaries: [], towersWithPosition: [] };
    }

    // Sort towers by orderIndex to ensure correct hex grid placement
    // Tower with orderIndex 0 -> center, 1-6 -> ring 1, 7-18 -> ring 2, etc.
    const sortedTowers = [...towers].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    // Generate axial coordinates for each tower
    const axialCoords = generateHexSpiralCoords(sortedTowers.length);
    
    // Build tower position map
    const towerMap = new Map<string, TowerWithPosition>();
    const towersWithPosition: TowerWithPosition[] = [];

    for (let idx = 0; idx < sortedTowers.length; idx++) {
      const tower = sortedTowers[idx];
      const axial = axialCoords[idx];
      const worldPos = axialToWorld(axial, hexSize);
      
      const towerFloors = floors.filter((f) => f.towerId === tower.towerId);
      const radius = getTowerMaxRadius(towerFloors) * floorRadiusScale;
      const floorCount = towerFloors.length;
      const maxFloorY = (floorCount - 1) * floorSpacing;

      const towerWithPos: TowerWithPosition = {
        towerId: tower.towerId,
        axial,
        worldPos,
        radius,
        maxFloorY,
        floorCount,
      };

      towerMap.set(axialKey(axial), towerWithPos);
      towersWithPosition.push(towerWithPos);
    }

    // Generate road segments between adjacent towers
    const roads: RoadSegment[] = [];
    const seenRoads = new Set<string>();

    for (const tower of towersWithPosition) {
      for (const dir of HEX_DIRECTIONS) {
        const neighborAxial: Axial = {
          q: tower.axial.q + dir.q,
          r: tower.axial.r + dir.r,
        };
        const neighbor = towerMap.get(axialKey(neighborAxial));
        
        if (neighbor) {
          // Create unique road ID (sorted tower IDs)
          const roadId = [tower.towerId, neighbor.towerId].sort((a, b) => a - b).join('-');
          
          if (!seenRoads.has(roadId)) {
            seenRoads.add(roadId);
            roads.push({
              id: roadId,
              fromTowerId: tower.towerId,
              toTowerId: neighbor.towerId,
              fromAxial: tower.axial,
              toAxial: neighbor.axial,
              fromWorld: tower.worldPos,
              toWorld: neighbor.worldPos,
            });
          }
        }
      }
    }

    // Generate tower boundaries for ascension detection
    const boundaries: TowerBoundary[] = towersWithPosition.map((tower) => ({
      towerId: tower.towerId,
      axial: tower.axial,
      center: tower.worldPos,
      radius: tower.radius,
      maxFloorY: tower.maxFloorY,
    }));

    return { roads, boundaries, towersWithPosition };
  }, [towers, floors, hexSize, floorRadiusScale, floorSpacing]);
}

/** Find the closest road segment to a world position */
export function findClosestRoad(
  position: Vec3,
  roads: RoadSegment[],
): { road: RoadSegment; progress: number; distance: number } | null {
  if (roads.length === 0) return null;

  let closestRoad: RoadSegment | null = null;
  let closestProgress = 0;
  let closestDistance = Infinity;

  for (const road of roads) {
    // Project position onto road line segment
    const ax = road.fromWorld[0];
    const az = road.fromWorld[2];
    const bx = road.toWorld[0];
    const bz = road.toWorld[2];
    const px = position[0];
    const pz = position[2];

    const abx = bx - ax;
    const abz = bz - az;
    const apx = px - ax;
    const apz = pz - az;

    const ab2 = abx * abx + abz * abz;
    if (ab2 === 0) continue;

    const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / ab2));
    
    const closestX = ax + t * abx;
    const closestZ = az + t * abz;
    
    const dx = px - closestX;
    const dz = pz - closestZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < closestDistance) {
      closestDistance = dist;
      closestRoad = road;
      closestProgress = t;
    }
  }

  if (closestRoad) {
    return { road: closestRoad, progress: closestProgress, distance: closestDistance };
  }
  return null;
}

/** Find tower boundary at a position (if inside any) */
export function findTowerAtPosition(
  position: Vec3,
  boundaries: TowerBoundary[],
): TowerBoundary | null {
  for (const boundary of boundaries) {
    const dx = position[0] - boundary.center[0];
    const dz = position[2] - boundary.center[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist <= boundary.radius) {
      return boundary;
    }
  }
  return null;
}

/** Get position along a road segment */
export function getRoadPosition(road: RoadSegment, progress: number): Vec3 {
  const t = Math.max(0, Math.min(1, progress));
  return [
    road.fromWorld[0] + (road.toWorld[0] - road.fromWorld[0]) * t,
    0,
    road.fromWorld[2] + (road.toWorld[2] - road.fromWorld[2]) * t,
  ];
}

/** Find adjacent roads at a tower (for turning at intersections) */
export function getConnectedRoads(
  towerId: number,
  roads: RoadSegment[],
): RoadSegment[] {
  return roads.filter(
    (road) => road.fromTowerId === towerId || road.toTowerId === towerId
  );
}
