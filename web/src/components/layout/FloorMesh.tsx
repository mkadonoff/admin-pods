import React from 'react';
import { Text } from '@react-three/drei';
import { Floor } from '../../api';
import { FLOOR_SPACING, FLOOR_RADIUS_SCALE, getTowerMaxRadius } from './constants';
import { RingMesh } from './RingMesh';

export interface FloorMeshProps {
  floor: Floor;
  floorIndex: number;
  TowerX: number;
  TowerZ: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
  onPodDoubleClick?: (podId: number) => void;
  hidePresencePod?: boolean;
  useLOD?: boolean;
}

// 3D Floor component - renders all rings
export const FloorMesh: React.FC<FloorMeshProps> = ({
  floor,
  floorIndex,
  TowerX,
  TowerZ,
  selectedPodId,
  onPodSelect,
  presencePodId,
  dimPodId,
  onPodDoubleClick,
  hidePresencePod = false,
  useLOD = false,
}) => {
  const floorY = floorIndex * FLOOR_SPACING;
  const rings = floor.rings || [];
  const floorRadius = getTowerMaxRadius([floor]) * FLOOR_RADIUS_SCALE;

  return (
    <group>
      {/* Floor label */}
      <Text
        position={[TowerX + floorRadius + 0.5, floorY + 0.7, TowerZ]}
        fontSize={0.6}
        color="#0063b1"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#f0f8ff"
        fontWeight="bold"
      >
        {floor.name}
      </Text>
      {/* Floor platform - frosted glass look */}
      <mesh position={[TowerX, floorY - 0.1, TowerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[floorRadius, 6]} />
        <meshStandardMaterial color="#e6f2ff" transparent opacity={0.85} metalness={0.1} roughness={0.3} />
      </mesh>
      {/* Floor edge ring - Azure steel accent */}
      <mesh position={[TowerX, floorY - 0.095, TowerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(floorRadius - 0.08, 0), floorRadius, 6]} />
        <meshStandardMaterial
          color="#0063b1"
          transparent
          opacity={0.9}
          metalness={0.6}
          roughness={0.3}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {/* Rings */}
      {rings.map((ring) => (
        <RingMesh
          key={ring.ringId}
          ring={ring}
          floorY={floorY}
          TowerX={TowerX}
          TowerZ={TowerZ}
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
