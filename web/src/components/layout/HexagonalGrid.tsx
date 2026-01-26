import React, { useMemo } from 'react';
import { Floor } from '../../api';
import { FLOOR_RADIUS_SCALE, TowerPosition, Axial, getTowerMaxRadius } from './constants';

export interface HexagonalGridProps {
  size: number;
  hexRadius: number;
  color: string;
  towerPositions: Record<number, TowerPosition>;
  floors: Floor[];
}

// Hexagonal Grid Component with CPU-based fade under platforms
export const HexagonalGrid: React.FC<HexagonalGridProps> = ({ 
  size, 
  hexRadius, 
  color, 
  towerPositions,
  floors,
}) => {
  const hexCoords = useMemo(() => {
    // Generate hex grid coordinates
    const coords: Axial[] = [];
    const rows = Math.ceil(size / (hexRadius * Math.sqrt(3)));
    
    for (let q = -rows; q <= rows; q++) {
      for (let r = -rows; r <= rows; r++) {
        const s = -q - r;
        if (Math.abs(q) <= rows && Math.abs(r) <= rows && Math.abs(s) <= rows) {
          coords.push({ q, r });
        }
      }
    }
    return coords;
  }, [size, hexRadius]);

  // Convert axial coords to world position (flat-top orientation for floor)
  const hexToWorld = (axial: Axial): [number, number] => {
    const x = hexRadius * (3/2 * axial.q);
    const z = hexRadius * (Math.sqrt(3)/2 * axial.q + Math.sqrt(3) * axial.r);
    return [x, z];
  };

  // Calculate platform radii for fade logic
  const platformRadii = useMemo(() => {
    const radii: Array<{ x: number; z: number; radius: number }> = [];
    Object.entries(towerPositions).forEach(([towerIdStr, pos]) => {
      const towerId = parseInt(towerIdStr);
      const towerFloors = floors.filter(f => f.towerId === towerId);
      const radius = getTowerMaxRadius(towerFloors) * FLOOR_RADIUS_SCALE;
      radii.push({ x: pos.x, z: pos.z, radius });
    });
    return radii;
  }, [towerPositions, floors]);

  // Create hexagon outline geometry (flat on ground plane)
  const hexOutline = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push([
        hexRadius * Math.cos(angle),
        0.01, // Slightly above ground to avoid z-fighting
        hexRadius * Math.sin(angle)
      ]);
    }
    return points;
  }, [hexRadius]);

  return (
    <group>
      {hexCoords.map((coord, idx) => {
        const [x, z] = hexToWorld(coord);
        
        // CPU-based fade: check distance to all platforms
        let opacity = 0.4; // Reduced base opacity for subtlety
        let isMajorGrid = false;
        
        // Every 5th hex line is a major grid line
        if (coord.q % 5 === 0 || coord.r % 5 === 0) {
          opacity = 0.6;
          isMajorGrid = true;
        }
        
        // Fade under platforms
        for (const platform of platformRadii) {
          const dx = x - platform.x;
          const dz = z - platform.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < platform.radius) {
            opacity = 0; // Completely fade under platforms
            break;
          }
        }
        
        // Skip rendering if fully transparent
        if (opacity === 0) return null;
        
        return (
          <lineSegments key={idx} position={[x, 0, z]}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={hexOutline.length}
                array={new Float32Array(hexOutline.flat())}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial 
              color={color} 
              opacity={opacity} 
              transparent 
              linewidth={isMajorGrid ? 1.5 : 1}
            />
          </lineSegments>
        );
      })}
    </group>
  );
};
