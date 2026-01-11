import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tower, Floor, Ring } from '../api';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, OrbitControls, Bounds } from '@react-three/drei';

const POD_RADIUS = 0.75;
const POD_HEIGHT = POD_RADIUS * 0.8 * 2;  // 1.2 - matches diameter for 1:1 ratio
const FLOOR_SPACING = POD_HEIGHT * 1.35;  // brings next floor closer to pod roof
const FLOOR_RADIUS_SCALE = 2.0; // reduced platform diameter
const Tower_GAP = 3;
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 5, 15];

type Vec3 = [number, number, number];

type TowerPosition = { x: number; z: number };

// Axial hex coords (pointy-top)
type Axial = { q: number; r: number };

function generateHexSpiralCoords(count: number): Axial[] {
  if (count <= 0) return [];

  const coords: Axial[] = [{ q: 0, r: 0 }];
  if (count === 1) return coords;

  const dirs: Axial[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  for (let k = 1; coords.length < count; k++) {
    // Start at (k, 0) then walk the hex ring
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

// Calculate max ring radius for an Tower
function getTowerMaxRadius(floors: Floor[]): number {
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
  opacity = 1,
}: {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  onClick: () => void;
  isPresencePod?: boolean;
  opacity?: number;
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
        <meshStandardMaterial color={podColor} transparent={opacity < 1} opacity={opacity} />
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
              opacity={0.35 * opacity}
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
  TowerX,
  TowerZ,
  selectedPodId,
  onPodSelect,
  presencePodId,
  dimPodId,
}: {
  ring: Ring;
  floorY: number;
  TowerX: number;
  TowerZ: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
}) {
  const pods = ring.pods || [];
  const radius = ring.radiusIndex * 2;

  return (
    <group>
      {pods.map((pod) => {
        let x: number, z: number;
        if (pod.slotIndex === -1) {
          // Center pod
          x = TowerX;
          z = TowerZ;
        } else {
          const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
          x = TowerX + radius * Math.cos(angle);
          z = TowerZ + radius * Math.sin(angle);
        }
        const hasAssignment = (pod.assignments?.length ?? 0) > 0;
        const isDimmed = dimPodId === pod.podId;
        return (
          <PodMesh
            key={pod.podId}
            position={[x, floorY + POD_HEIGHT / 2, z]}
            isSelected={selectedPodId === pod.podId}
            hasAssignment={hasAssignment}
            onClick={() => onPodSelect(pod.podId)}
            isPresencePod={presencePodId === pod.podId}
            opacity={isDimmed ? 0.2 : 1}
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
  TowerX,
  TowerZ,
  selectedPodId,
  onPodSelect,
  presencePodId,
  dimPodId,
}: {
  floor: Floor;
  floorIndex: number;
  TowerX: number;
  TowerZ: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
}) {
  const floorY = floorIndex * FLOOR_SPACING;
  const rings = floor.rings || [];
  const floorRadius = getTowerMaxRadius([floor]) * FLOOR_RADIUS_SCALE;

  return (
    <group>
      {/* Floor label */}
      <Text
        position={[TowerX + floorRadius + 0.5, floorY, TowerZ]}
        fontSize={0.5}
        color="#0078d4"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
        {floor.name}
      </Text>
      {/* Floor platform */}
      <mesh position={[TowerX, floorY - 0.1, TowerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[floorRadius, 6]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* Floor edge ring for visibility */}
      <mesh position={[TowerX, floorY - 0.095, TowerZ]} rotation={[-Math.PI / 2, 0, 0]}>
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
          TowerX={TowerX}
          TowerZ={TowerZ}
          selectedPodId={selectedPodId}
          onPodSelect={onPodSelect}
          presencePodId={presencePodId}
          dimPodId={dimPodId}
        />
      ))}
    </group>
  );
}

// 3D Tower component - renders floors stacked with a label
function TowerMesh({
  Tower,
  floors,
  position,
  selectedPodId,
  onPodSelect,
  presencePodId,
  dimPodId,
}: {
  Tower: Tower;
  floors: Floor[];
  position: TowerPosition;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
}) {
  const sortedFloors = [...floors].sort((a, b) => a.orderIndex - b.orderIndex);
  const labelY = sortedFloors.length * FLOOR_SPACING + 1;

  return (
    <group>
      {/* Tower label */}
      <Text
        position={[position.x, labelY, position.z]}
        fontSize={0.8}
        color="#0078d4"
        anchorX="center"
        anchorY="bottom"
      >
        {Tower.name}
      </Text>
      {/* Floors */}
      {sortedFloors.map((floor, idx) => (
        <FloorMesh
          key={floor.floorId}
          floor={floor}
          floorIndex={idx}
          TowerX={position.x}
          TowerZ={position.z}
          selectedPodId={selectedPodId}
          onPodSelect={onPodSelect}
          presencePodId={presencePodId}
          dimPodId={dimPodId}
        />
      ))}
    </group>
  );
}

interface LayoutViewProps {
  towers: Tower[];
  floors: Floor[];
  activeTowerId: number | null;
  selectedFloorId: number | null;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  assignmentsVersion?: number;
  onLayoutChanged?: () => void;
  presencePodId?: number | null;
  processRequest?: { podId: number; nonce: number } | null;
  onRequestProcessSelected?: () => void;
}

export const LayoutView: React.FC<LayoutViewProps> = ({
  towers,
  floors,
  activeTowerId: _activeTowerId,
  selectedFloorId: _selectedFloorId,
  selectedPodId,
  onPodSelect,
  assignmentsVersion: _assignmentsVersion,
  onLayoutChanged: _onLayoutChanged,
  presencePodId,
  processRequest,
  onRequestProcessSelected,
}) => {
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(INITIAL_CAMERA_POSITION);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);

  type Segment = { from: Vec3; to: Vec3; durationSec: number };
  type WorkflowRun = {
    podId: number;
    origin: Vec3;
    segments: Segment[];
    segmentIndex: number;
    segmentElapsedSec: number;
    position: Vec3;
    active: boolean;
  };

  const [workflow, setWorkflow] = useState<WorkflowRun | null>(null);

  const navStateRef = useRef({
    position: INITIAL_CAMERA_POSITION as Vec3,
    yawStep: 0,
    pitchStep: 0,
  });

  // Place towers in a hexagonal (honeycomb) grid instead of a single line.
  const TowerPositions = useMemo(() => {
    const positions: Record<number, TowerPosition> = {};
    if (towers.length === 0) return positions;

    // Use a conservative uniform spacing based on the largest Tower footprint.
    let maxTowerRadiusWorld = 1;
    for (const Tower of towers) {
      const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
      maxTowerRadiusWorld = Math.max(maxTowerRadiusWorld, getTowerMaxRadius(TowerFloors) * FLOOR_RADIUS_SCALE);
    }

    const minCenterDist = 2 * maxTowerRadiusWorld + Tower_GAP;
    const hexSize = minCenterDist / Math.sqrt(3); // adjacent center distance is sqrt(3)*size

    const axialCoords = generateHexSpiralCoords(towers.length);

    for (let idx = 0; idx < towers.length; idx++) {
      const Tower = towers[idx];
      const { q, r } = axialCoords[idx];
      const x = hexSize * Math.sqrt(3) * (q + r / 2);
      const z = hexSize * (3 / 2) * r;
      positions[Tower.towerId] = { x, z };
    }

    return positions;
  }, [towers, floors]);

  // Camera position based on towers
  const idealCameraPosition = useMemo<[number, number, number]>(() => {
    if (towers.length === 0) return INITIAL_CAMERA_POSITION;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    let maxFloors = 1;
    for (const Tower of towers) {
      const pos = TowerPositions[Tower.towerId] ?? { x: 0, z: 0 };
      const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
      maxFloors = Math.max(maxFloors, TowerFloors.length || 1);
      const radiusWorld = getTowerMaxRadius(TowerFloors) * FLOOR_RADIUS_SCALE;
      minX = Math.min(minX, pos.x - radiusWorld);
      maxX = Math.max(maxX, pos.x + radiusWorld);
      minZ = Math.min(minZ, pos.z - radiusWorld);
      maxZ = Math.max(maxZ, pos.z + radiusWorld);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const extent = Math.max(maxX - minX, maxZ - minZ);

    // Pull the camera back along +Z to fit the entire layout.
    return [centerX, maxFloors * FLOOR_SPACING, centerZ + extent * 0.9 + 15];
  }, [towers, floors, TowerPositions]);

  useEffect(() => {
    if (towers.length === 0) {
      setCameraPosition(INITIAL_CAMERA_POSITION);
      setCameraInitialized(false);
      return;
    }
    if (!cameraInitialized) {
      setCameraPosition(idealCameraPosition);
      setCameraInitialized(true);
    }
  }, [towers.length, idealCameraPosition, cameraInitialized]);

  const findPodSceneInfo = useCallback(
    (podId: number): { origin: Vec3; TowerX: number; TowerZ: number } | null => {
      for (const floor of floors) {
        for (const ring of floor.rings || []) {
          for (const pod of ring.pods || []) {
            if (pod.podId !== podId) continue;
            const TowerPos = TowerPositions[floor.towerId] ?? { x: 0, z: 0 };
            const TowerX = TowerPos.x;
            const TowerZ = TowerPos.z;
            const floorsInTower = floors.filter((f) => f.towerId === floor.towerId);
            const sortedFloors = [...floorsInTower].sort((a, b) => a.orderIndex - b.orderIndex);
            const floorIndex = sortedFloors.findIndex((f) => f.floorId === floor.floorId);
            const safeFloorIndex = floorIndex >= 0 ? floorIndex : 0;
            const floorY = safeFloorIndex * FLOOR_SPACING;

            const radius = ring.radiusIndex * 2;
            let x: number;
            let z: number;
            if (pod.slotIndex === -1) {
              x = TowerX;
              z = TowerZ;
            } else {
              const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
              x = TowerX + radius * Math.cos(angle);
              z = TowerZ + radius * Math.sin(angle);
            }

            return { origin: [x, floorY + POD_HEIGHT / 2, z], TowerX, TowerZ };
          }
        }
      }
      return null;
    },
    [floors, TowerPositions],
  );

  const layoutExtents = useMemo(() => {
    if (towers.length === 0) {
      return { zOutside: 10, maxFloors: 1 };
    }

    let maxRadiusIndexPlusOne = 1;
    let maxFloors = 1;

    for (const Tower of towers) {
      const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
      maxFloors = Math.max(maxFloors, TowerFloors.length || 1);
      const maxRadius = getTowerMaxRadius(TowerFloors);
      maxRadiusIndexPlusOne = Math.max(maxRadiusIndexPlusOne, maxRadius);
    }

    const maxRingRadius = (maxRadiusIndexPlusOne - 1) * 2;
    const margin = 6;
    const zOutside = maxRingRadius + margin;
    return { zOutside, maxFloors };
  }, [towers, floors, TowerPositions]);

  const startWorkflow = useCallback(
    (podId: number) => {
      const info = findPodSceneInfo(podId);
      if (!info) return;
      const origin = info.origin;
      const TowerX = info.TowerX;
      const TowerZ = info.TowerZ;

      const { zOutside, maxFloors } = layoutExtents;
      const exitY = maxFloors * FLOOR_SPACING + POD_HEIGHT / 2;
      const belowY = -FLOOR_SPACING + POD_HEIGHT / 2;

      // "radius = 0" means the ring center position for this Tower.
      const centerOnLevel: Vec3 = [TowerX, origin[1], TowerZ];
      const topAboveHighest: Vec3 = [TowerX, exitY, TowerZ];
      const outsideAtTop: Vec3 = [TowerX, exitY, TowerZ + zOutside];
      const outsideBelow: Vec3 = [TowerX, belowY, TowerZ + zOutside];
      const centerBelow: Vec3 = [TowerX, belowY, TowerZ];
      const centerBackAtStartLevel: Vec3 = [TowerX, origin[1], TowerZ];

      const speed = 6;
      const durationFor = (from: Vec3, to: Vec3) => {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dz = to[2] - from[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return Math.max(0.35, dist / speed);
      };

      const waypoints: Vec3[] = [
        origin,
        centerOnLevel,
        topAboveHighest,
        outsideAtTop,
        outsideBelow,
        centerBelow,
        centerBackAtStartLevel,
        origin,
      ];
      const segments: Segment[] = waypoints.slice(0, -1).map((from, idx) => {
        const to = waypoints[idx + 1];
        return { from, to, durationSec: durationFor(from, to) };
      });

      setWorkflow({
        podId,
        origin,
        segments,
        segmentIndex: 0,
        segmentElapsedSec: 0,
        position: origin,
        active: true,
      });
    },
    [findPodSceneInfo, layoutExtents],
  );

  useEffect(() => {
    if (!processRequest) return;
    startWorkflow(processRequest.podId);
  }, [processRequest?.nonce]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        setNavigationMode((v) => !v);
      }
      if (event.key === 'Escape') {
        setNavigationMode(false);
      }
      if (event.key === 'p' || event.key === 'P') {
        onRequestProcessSelected?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRequestProcessSelected]);

  const workflowDimPodId = workflow?.active ? workflow.podId : null;

  const SceneControllers: React.FC = () => {
    const { camera, gl } = useThree();

    useEffect(() => {
      navStateRef.current.position = cameraPosition;
      if (!navigationMode) return;

      const onKeyDown = (event: KeyboardEvent) => {
        // Ignore keyboard shortcuts when typing in input fields
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        const state = navStateRef.current;
        const stepDist = 1.25;
        const stepAngle = Math.PI / 3;
        const maxPitchSteps = 2;

        if (event.key === '0') {
          event.preventDefault();
          state.position = idealCameraPosition;
          state.yawStep = 0;
          state.pitchStep = 0;
          return;
        }

        const yaw = state.yawStep * stepAngle;
        const pitch = state.pitchStep * stepAngle;

        const forward: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
        const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];

        const move = (dir: Vec3) => {
          state.position = [
            state.position[0] + dir[0] * stepDist,
            state.position[1] + dir[1] * stepDist,
            state.position[2] + dir[2] * stepDist,
          ];
        };

        switch (event.key) {
          case 'w':
          case 'W':
            event.preventDefault();
            move(forward);
            break;
          case 's':
          case 'S':
            event.preventDefault();
            move([-forward[0], -forward[1], -forward[2]]);
            break;
          case 'a':
          case 'A':
            event.preventDefault();
            move([-right[0], -right[1], -right[2]]);
            break;
          case 'd':
          case 'D':
            event.preventDefault();
            move(right);
            break;
          case 'r':
          case 'R':
            event.preventDefault();
            move([0, 1, 0]);
            break;
          case 'f':
          case 'F':
            event.preventDefault();
            move([0, -1, 0]);
            break;
          case 'q':
          case 'Q':
          case 'ArrowLeft':
            event.preventDefault();
            state.yawStep -= 1;
            break;
          case 'e':
          case 'E':
          case 'ArrowRight':
            event.preventDefault();
            state.yawStep += 1;
            break;
          case 'ArrowUp':
            event.preventDefault();
            state.pitchStep = Math.min(maxPitchSteps, state.pitchStep + 1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            state.pitchStep = Math.max(-maxPitchSteps, state.pitchStep - 1);
            break;
          default:
            break;
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [navigationMode, cameraPosition, idealCameraPosition]);

    useEffect(() => {
      if (!navigationMode) return;
      gl.domElement.style.cursor = 'crosshair';
      return () => {
        gl.domElement.style.cursor = 'default';
      };
    }, [navigationMode, gl.domElement]);

    useFrame((_, delta) => {
      // Workflow animation tick
      setWorkflow((current) => {
        if (!current?.active) return current;
        const segment = current.segments[current.segmentIndex];
        if (!segment) {
          return { ...current, active: false };
        }

        const nextElapsed = current.segmentElapsedSec + delta;
        const t = Math.min(1, nextElapsed / segment.durationSec);
        const lerp = (a: number, b: number) => a + (b - a) * t;
        const nextPos: Vec3 = [
          lerp(segment.from[0], segment.to[0]),
          lerp(segment.from[1], segment.to[1]),
          lerp(segment.from[2], segment.to[2]),
        ];

        if (t >= 1) {
          const nextIndex = current.segmentIndex + 1;
          if (nextIndex >= current.segments.length) {
            return { ...current, position: segment.to, active: false, segmentIndex: nextIndex, segmentElapsedSec: 0 };
          }
          return { ...current, position: segment.to, segmentIndex: nextIndex, segmentElapsedSec: 0 };
        }

        return { ...current, position: nextPos, segmentElapsedSec: nextElapsed };
      });

      // Navigation camera tick
      if (navigationMode) {
        const stepAngle = Math.PI / 3;
        const yaw = navStateRef.current.yawStep * stepAngle;
        const pitch = navStateRef.current.pitchStep * stepAngle;
        camera.position.set(...navStateRef.current.position);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = -pitch;
        camera.updateProjectionMatrix();
      }
    });

    return (
      <>
        {workflow?.active && (
          <PodMesh
            position={workflow.position}
            isSelected={true}
            hasAssignment={true}
            onClick={() => {}}
          />
        )}
      </>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* 3D View */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, height: '100%', backgroundColor: '#e8eef3' }}>
        <Canvas camera={{ position: cameraPosition, fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={['#e8eef3']} />
          {!navigationMode && <OrbitControls makeDefault enablePan enableZoom enableRotate />}
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <gridHelper args={[100, 50, '#c0c8d0', '#d8e0e8']} />

          <SceneControllers />

          <Bounds clip margin={1.5}>
            <group>
              {towers.map((Tower) => {
                const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
                return (
                  <TowerMesh
                    key={Tower.towerId}
                    Tower={Tower}
                    floors={TowerFloors}
                    position={TowerPositions[Tower.towerId] || { x: 0, z: 0 }}
                    selectedPodId={selectedPodId}
                    onPodSelect={onPodSelect}
                    presencePodId={presencePodId}
                    dimPodId={workflowDimPodId}
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
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(255,255,255,0.95)',
            padding: '6px 12px',
            fontSize: '10px',
            borderTop: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: '#0078d4', borderRadius: '2px' }} />
              Empty
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: '#107c10', borderRadius: '2px' }} />
              Assigned
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: '#ffb900', borderRadius: '2px' }} />
              Selected
            </span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <strong>Nav:</strong> N toggle, Esc exit · Move: W/S A/D R/F · Look: Q/E arrows · Reset: 0 · <strong>Process:</strong> P
          </span>
        </div>
      </div>

    </div>
  );
};

