/**
 * Road Network Visual Component
 * 
 * Renders visible road segments connecting tower bases.
 * Uses semi-transparent white lines with subtle emissive glow.
 */

import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { RoadSegment } from './PodNavigationTypes';

interface RoadNetworkProps {
  roads: RoadSegment[];
  visible?: boolean;
}

export const RoadNetwork: React.FC<RoadNetworkProps> = ({ roads, visible = true }) => {
  if (!visible || roads.length === 0) return null;

  return (
    <group>
      {roads.map((road) => (
        <RoadLine key={road.id} road={road} />
      ))}
    </group>
  );
};

interface RoadLineProps {
  road: RoadSegment;
}

const RoadLine: React.FC<RoadLineProps> = ({ road }) => {
  const points = useMemo(() => {
    // Create points slightly above ground to avoid z-fighting
    const y = 0.02;
    return [
      [road.fromWorld[0], y, road.fromWorld[2]] as [number, number, number],
      [road.toWorld[0], y, road.toWorld[2]] as [number, number, number],
    ];
  }, [road]);

  return (
    <group>
      {/* Main road line */}
      <Line
        points={points}
        color="#0078d4"
        lineWidth={2}
        transparent
        opacity={0.3}
      />
      {/* Glow effect - wider, more transparent line behind */}
      <Line
        points={points}
        color="#0078d4"
        lineWidth={6}
        transparent
        opacity={0.1}
      />
      {/* Road center markers at endpoints */}
      <mesh position={[road.fromWorld[0], 0.03, road.fromWorld[2]]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color="#0078d4" transparent opacity={0.25} />
      </mesh>
      <mesh position={[road.toWorld[0], 0.03, road.toWorld[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshBasicMaterial color="#0078d4" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

export default RoadNetwork;
