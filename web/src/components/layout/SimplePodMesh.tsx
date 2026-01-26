import React from 'react';
import { POD_RADIUS, POD_HEIGHT } from './constants';

export interface SimplePodMeshProps {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  onClick: () => void;
  isPresencePod?: boolean;
  stateColor?: string | null;
}

// Simple pod for LOD - single mesh for performance with many pods
export const SimplePodMesh: React.FC<SimplePodMeshProps> = ({
  position,
  isSelected,
  hasAssignment,
  onClick,
  isPresencePod = false,
  stateColor,
}) => {
  const podRadius = POD_RADIUS * 0.8;
  
  const color = isPresencePod
    ? '#9966cc'
    : isSelected
      ? '#ffbb44'
      : stateColor
        ? stateColor
        : hasAssignment
          ? '#66aa77'
          : '#6699cc';
  
  return (
    <mesh position={position} onClick={onClick}>
      <cylinderGeometry args={[podRadius, podRadius, POD_HEIGHT, 6]} />
      <meshStandardMaterial 
        color={color}
        transparent
        opacity={0.7}
        metalness={0.3}
        roughness={0.5}
      />
    </mesh>
  );
};
