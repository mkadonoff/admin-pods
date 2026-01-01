import React, { useEffect, useMemo, useState } from 'react';
import { Assembly, Floor, Ring } from '../api';
import { Canvas } from '@react-three/fiber';
import { Text, OrbitControls, Bounds } from '@react-three/drei';

const POD_RADIUS = 0.75;
const POD_HEIGHT = POD_RADIUS * 0.8 * 2;  // 1.2 - matches diameter for 1:1 ratio
const FLOOR_SPACING = POD_HEIGHT * 1.35;  // brings next floor closer to pod roof
const FLOOR_RADIUS_SCALE = 2.0; // reduced platform diameter
const ASSEMBLY_GAP = 3;
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 5, 15];

// Calculate max ring radius for an assembly
function getAssemblyMaxRadius(floors: Floor[]): number {
  let maxRadius = 1;
  for (const floor of floors) {
    for (const ring of floor.rings || []) {
      maxRadius = Math.max(maxRadius, ring.radiusIndex + 1);
    }
  }
  return maxRadius;
}

// 3D Pod component
function PodMesh({
  position,
  isSelected,
  hasAssignment,
  onClick,
  isPresencePod = false,
}: {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  onClick: () => void;
  isPresencePod?: boolean;
}) {
  const podColor = isPresencePod
    ? '#c239b3'
    : isSelected
      ? '#ffb900'
      : hasAssignment
        ? '#107c10'
        : '#0078d4';
  const windowColor = '#ffffff';
  const windowCount = 6;
  const windowWidth = POD_RADIUS * 0.55;
  const windowHeight = POD_HEIGHT * 0.65;
  const windowOffset = POD_RADIUS * 0.8 - 0.02; // keeps windows slightly inset to avoid z-fighting

  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[POD_RADIUS * 0.8, POD_RADIUS * 0.8, POD_HEIGHT, 6]} />
        <meshStandardMaterial color={podColor} />
      </mesh>
      {isPresencePod && (
        <Text
          position={[0, POD_HEIGHT * 0.9, 0]}
          fontSize={0.4}
          color="#c239b3"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#ffffff"
        >
          YOU
        </Text>
      )}
      {Array.from({ length: windowCount }).map((_, idx) => {
        const angle = (idx / windowCount) * Math.PI * 2 + Math.PI / windowCount;
        const x = Math.sin(angle) * windowOffset;
        const z = Math.cos(angle) * windowOffset;
        return (
          <mesh key={idx} position={[x, 0, z]} rotation={[0, angle, 0]}>
            <planeGeometry args={[windowWidth, windowHeight]} />
            <meshStandardMaterial
              color={windowColor}
              transparent
              opacity={0.35}
              metalness={0.1}
              roughness={0.2}
              emissive={windowColor}
              emissiveIntensity={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// 3D Ring component - renders pods in a circle
function RingMesh({
  ring,
  floorY,
  assemblyX,
  selectedPodId,
  onPodSelect,
  presencePodId,
}: {
  ring: Ring;
  floorY: number;
  assemblyX: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
}) {
  const pods = ring.pods || [];
  const radius = ring.radiusIndex * 2;

  return (
    <group>
      {pods.map((pod) => {
        let x: number, z: number;
        if (pod.slotIndex === -1) {
          // Center pod
          x = assemblyX;
          z = 0;
        } else {
          const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
          x = assemblyX + radius * Math.cos(angle);
          z = radius * Math.sin(angle);
        }
        const hasAssignment = (pod.assignments?.length ?? 0) > 0;
        return (
          <PodMesh
            key={pod.podId}
            position={[x, floorY + POD_HEIGHT / 2, z]}
            isSelected={selectedPodId === pod.podId}
            hasAssignment={hasAssignment}
            onClick={() => onPodSelect(pod.podId)}
            isPresencePod={presencePodId === pod.podId}
          />
        );
      })}
    </group>
  );
}

// 3D Floor component - renders all rings
function FloorMesh({
  floor,
  floorIndex,
  assemblyX,
  selectedPodId,
  onPodSelect,
  presencePodId,
}: {
  floor: Floor;
  floorIndex: number;
  assemblyX: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
}) {
  const floorY = floorIndex * FLOOR_SPACING;
  const rings = floor.rings || [];
  const floorRadius = getAssemblyMaxRadius([floor]) * FLOOR_RADIUS_SCALE;

  return (
    <group>
      {/* Floor platform */}
      <mesh position={[assemblyX, floorY - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[floorRadius, 6]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* Floor edge ring for visibility */}
      <mesh position={[assemblyX, floorY - 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(floorRadius - 0.08, 0), floorRadius, 6]} />
        <meshStandardMaterial
          color="#0078d4"
          transparent
          opacity={0.8}
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
          assemblyX={assemblyX}
          selectedPodId={selectedPodId}
          onPodSelect={onPodSelect}
          presencePodId={presencePodId}
        />
      ))}
    </group>
  );
}

// 3D Assembly component - renders floors stacked with a label
function AssemblyMesh({
  assembly,
  floors,
  xOffset,
  selectedPodId,
  onPodSelect,
  presencePodId,
}: {
  assembly: Assembly;
  floors: Floor[];
  xOffset: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
}) {
  const sortedFloors = [...floors].sort((a, b) => a.orderIndex - b.orderIndex);
  const labelY = sortedFloors.length * FLOOR_SPACING + 1;

  return (
    <group>
      {/* Assembly label */}
      <Text
        position={[xOffset, labelY, 0]}
        fontSize={0.8}
        color="#0078d4"
        anchorX="center"
        anchorY="bottom"
      >
        {assembly.name}
      </Text>
      {/* Floors */}
      {sortedFloors.map((floor, idx) => (
        <FloorMesh
          key={floor.floorId}
          floor={floor}
          floorIndex={idx}
          assemblyX={xOffset}
          selectedPodId={selectedPodId}
          onPodSelect={onPodSelect}
          presencePodId={presencePodId}
        />
      ))}
    </group>
  );
}

interface LayoutViewProps {
  assemblies: Assembly[];
  floors: Floor[];
  activeAssemblyId: number | null;
  selectedFloorId: number | null;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  assignmentsVersion?: number;
  onLayoutChanged?: () => void;
  presencePodId?: number | null;
}

export const LayoutView: React.FC<LayoutViewProps> = ({
  assemblies,
  floors,
  activeAssemblyId: _activeAssemblyId,
  selectedFloorId: _selectedFloorId,
  selectedPodId,
  onPodSelect,
  assignmentsVersion: _assignmentsVersion,
  onLayoutChanged: _onLayoutChanged,
  presencePodId,
}) => {
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(INITIAL_CAMERA_POSITION);
  const [cameraInitialized, setCameraInitialized] = useState(false);

  // Calculate X offsets for each assembly based on max ring radius
  const assemblyOffsets = useMemo(() => {
    const offsets: Record<number, number> = {};
    let currentX = 0;

    for (const assembly of assemblies) {
      const assemblyFloors = floors.filter((f) => f.assemblyId === assembly.assemblyId);
      const maxRadius = getAssemblyMaxRadius(assemblyFloors);
      const width = maxRadius * 2 * 2; // diameter in scene units

      offsets[assembly.assemblyId] = currentX + width / 2;
      currentX += width + ASSEMBLY_GAP;
    }

    return offsets;
  }, [assemblies, floors]);

  // Camera position based on assemblies
  const idealCameraPosition = useMemo<[number, number, number]>(() => {
    if (assemblies.length === 0) return INITIAL_CAMERA_POSITION;
    const totalWidth = Object.values(assemblyOffsets).reduce((max, x) => Math.max(max, x), 0);
    const centerX = totalWidth / 2;
    const maxFloors = Math.max(
      ...assemblies.map((a) => floors.filter((f) => f.assemblyId === a.assemblyId).length),
      1,
    );
    return [centerX, maxFloors * FLOOR_SPACING, totalWidth + 10];
  }, [assemblies, floors, assemblyOffsets]);

  useEffect(() => {
    if (assemblies.length === 0) {
      setCameraPosition(INITIAL_CAMERA_POSITION);
      setCameraInitialized(false);
      return;
    }
    if (!cameraInitialized) {
      setCameraPosition(idealCameraPosition);
      setCameraInitialized(true);
    }
  }, [assemblies.length, idealCameraPosition, cameraInitialized]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* 3D View */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, height: '100%', backgroundColor: '#e8eef3' }}>
        <Canvas camera={{ position: cameraPosition, fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={['#e8eef3']} />
          <OrbitControls makeDefault enablePan enableZoom enableRotate />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <gridHelper args={[100, 50, '#c0c8d0', '#d8e0e8']} />

          <Bounds clip margin={1.5}>
            <group>
              {assemblies.map((assembly) => {
                const assemblyFloors = floors.filter((f) => f.assemblyId === assembly.assemblyId);
                return (
                  <AssemblyMesh
                    key={assembly.assemblyId}
                    assembly={assembly}
                    floors={assemblyFloors}
                    xOffset={assemblyOffsets[assembly.assemblyId] || 0}
                    selectedPodId={selectedPodId}
                    onPodSelect={onPodSelect}
                    presencePodId={presencePodId}
                  />
                );
              })}
            </group>
          </Bounds>
        </Canvas>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: 'rgba(255,255,255,0.95)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: '#0078d4', marginRight: 5, borderRadius: '2px' }} />
              Empty
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: '#107c10', marginRight: 5, borderRadius: '2px' }} />
              Assigned
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: '#ffb900', marginRight: 5, borderRadius: '2px' }} />
              Selected
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
