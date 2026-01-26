import React from 'react';
import { Text } from '@react-three/drei';
import { Tower, Floor } from '../../api';
import { FLOOR_SPACING, TowerPosition } from './constants';
import { FloorMesh } from './FloorMesh';

export interface TowerMeshProps {
  Tower: Tower;
  floors: Floor[];
  position: TowerPosition;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
  onPodDoubleClick?: (podId: number) => void;
  hidePresencePod?: boolean;
}

// 3D Tower component - renders floors stacked with a label
export const TowerMesh: React.FC<TowerMeshProps> = ({
  Tower,
  floors,
  position,
  selectedPodId,
  onPodSelect,
  presencePodId,
  dimPodId,
  onPodDoubleClick,
  hidePresencePod = false,
}) => {
  const sortedFloors = [...floors].sort((a, b) => a.orderIndex - b.orderIndex);
  // Calculate label position based on highest floor orderIndex
  const maxOrderIndex = sortedFloors.length > 0 
    ? Math.max(...sortedFloors.map(f => f.orderIndex)) 
    : 0;
  const labelY = (maxOrderIndex + 1) * FLOOR_SPACING + 1;
  
  // Enable LOD for towers with many floors or pods (performance optimization)
  const totalPods = floors.reduce((sum, floor) => 
    sum + (floor.rings || []).reduce((ringSum, ring) => 
      ringSum + (ring.pods?.length || 0), 0), 0);
  const useLOD = floors.length > 10 || totalPods > 500;

  return (
    <group>
      {/* Tower label */}
      <Text
        position={[position.x, labelY, position.z]}
        fontSize={0.9}
        color="#0063b1"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.08}
        outlineColor="#f0f8ff"
        fontWeight="bold"
      >
        {Tower.name}
      </Text>
      {/* Floors */}
      {sortedFloors.map((floor) => (
        <FloorMesh
          key={floor.floorId}
          floor={floor}
          floorIndex={floor.orderIndex}
          TowerX={position.x}
          TowerZ={position.z}
          selectedPodId={selectedPodId}
          onPodSelect={onPodSelect}
          presencePodId={presencePodId}
          dimPodId={dimPodId}
          onPodDoubleClick={onPodDoubleClick}
          hidePresencePod={hidePresencePod}
          useLOD={useLOD}
        />
      ))}
    </group>
  );
};
