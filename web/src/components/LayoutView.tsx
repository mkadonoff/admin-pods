import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tower, Floor, Ring, getStateColor } from '../api';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, OrbitControls, Bounds } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
  Vec3 as NavVec3,
  NavigationState,
  DEFAULT_NAVIGATION_STATE,
  SPEED_VALUES,
  SpeedLevel,
  CameraHeight,
  NavAction,
  NAV_KEY_BINDINGS,
  parabolicLerp,
  TowerBoundary,
} from '../navigation';
import { useRoadNetwork, findClosestRoad, getRoadPosition, getConnectedRoads } from '../navigation';
import { RoadNetwork } from '../navigation';

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

// Hexagonal Grid Component with CPU-based fade under platforms and dashed lines
function HexagonalGrid({ 
  size, 
  hexRadius, 
  color, 
  towerPositions,
  floors,
}: { 
  size: number; 
  hexRadius: number; 
  color: string;
  towerPositions: Record<number, TowerPosition>;
  floors: Floor[];
}) {
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
}

// Humanoid skeleton figure sitting at desk with 6 segments (head, torso, 2 arms, 2 legs)
function HumanoidSkeleton({
  position,
  scale = 1,
  color = '#0063b1',
  faceAngle = 0,
}: {
  position: [number, number, number];
  scale?: number;
  color?: string;
  faceAngle?: number;
}) {
  const segmentRadius = 0.03 * scale;
  const headRadius = 0.12 * scale;
  const torsoHeight = 0.5 * scale;
  const upperLegLength = 0.3 * scale;
  const lowerLegLength = 0.3 * scale;
  const upperArmLength = 0.15 * scale; // shorter arms
  const forearmLength = 0.18 * scale; // shorter forearms
  const shoulderWidth = 0.08 * scale; // same as leg spacing
  
  // Sitting position - chair/desk heights
  const seatHeight = 0.25 * scale;
  const limbGap = 0.05 * scale; // vertical gap between limbs and furniture
  const deskDepth = 0.3 * scale;
  const deskWidth = 0.5 * scale;
  const deskZ = 0.25 * scale; // Desk position closer
  
  // Body positions (sitting)
  const hipY = seatHeight + limbGap;
  const torsoY = hipY + torsoHeight / 2;
  const headY = torsoY + torsoHeight / 2 + headRadius * 0.8;
  const shoulderY = torsoY + torsoHeight / 2 - 0.08 * scale; // shoulders lowered
  const elbowY = shoulderY - upperArmLength;
  const deskHeight = elbowY - limbGap; // same gap as legs to seat
  
  return (
    <group position={position} rotation={[0, faceAngle, 0]}>
      {/* Desk */}
      <mesh position={[0, deskHeight, deskZ]}>
        <boxGeometry args={[deskWidth, 0.03 * scale, deskDepth]} />
        <meshStandardMaterial color="#5a4a3a" metalness={0.2} roughness={0.8} />
      </mesh>
      
      {/* Chair seat (simple) */}
      <mesh position={[0, seatHeight, 0]}>
        <boxGeometry args={[0.25 * scale, 0.03 * scale, 0.2 * scale]} />
        <meshStandardMaterial color="#333333" metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, headY, 0]}>
        <sphereGeometry args={[headRadius, 12, 12]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, torsoY, 0]}>
        <cylinderGeometry args={[segmentRadius * 1.5, segmentRadius * 1.5, torsoHeight, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Left upper arm - almost vertical, slight forward lean */}
      {(() => {
        const upperArmStartY = shoulderY;
        const upperArmAngle = 0.15; // almost vertical
        const elbowY = upperArmStartY - upperArmLength;
        const elbowZ = 0.02 * scale; // slight forward
        return (
          <>
            <mesh position={[-shoulderWidth, upperArmStartY - upperArmLength / 2, elbowZ / 2]} rotation={[upperArmAngle, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, upperArmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Left forearm - horizontal, reaching forward to keyboard */}
            <mesh position={[-shoulderWidth, elbowY, elbowZ + forearmLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, forearmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
          </>
        );
      })()}
      
      {/* Right upper arm - almost vertical, slight forward lean */}
      {(() => {
        const upperArmStartY = shoulderY;
        const upperArmAngle = 0.15; // almost vertical
        const elbowY = upperArmStartY - upperArmLength;
        const elbowZ = 0.02 * scale; // slight forward
        return (
          <>
            <mesh position={[shoulderWidth, upperArmStartY - upperArmLength / 2, elbowZ / 2]} rotation={[upperArmAngle, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, upperArmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Right forearm - horizontal, reaching forward to keyboard */}
            <mesh position={[shoulderWidth, elbowY, elbowZ + forearmLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, forearmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
          </>
        );
      })()}
      
      {/* Left upper leg - horizontal (sitting) */}
      <mesh position={[-0.08 * scale, hipY, upperLegLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, upperLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Left lower leg - vertical (sitting) */}
      <mesh position={[-0.08 * scale, hipY / 2, upperLegLength]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, lowerLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Right upper leg - horizontal (sitting) */}
      <mesh position={[0.08 * scale, hipY, upperLegLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, upperLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Right lower leg - vertical (sitting) */}
      <mesh position={[0.08 * scale, hipY / 2, upperLegLength]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, lowerLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// Simple pod for LOD - single mesh for performance with many pods
function SimplePodMesh({
  position,
  isSelected,
  hasAssignment,
  onClick,
  isPresencePod = false,
  stateColor,
}: {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  onClick: () => void;
  isPresencePod?: boolean;
  stateColor?: string | null;
}) {
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
}

// 3D Pod component with glass and steel frame
function PodMesh({
  position,
  isSelected,
  hasAssignment,
  hasHumanoid = false,
  faceAngle = 0,
  onClick,
  onDoubleClick,
  isPresencePod = false,
  opacity = 1,
  stateColor,
}: {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  hasHumanoid?: boolean;
  faceAngle?: number;
  onClick: () => void;
  onDoubleClick?: () => void;
  isPresencePod?: boolean;
  opacity?: number;
  stateColor?: string | null;
}) {
  // Accent color for the steel frame - Azure-themed metallic blue
  const frameColor = '#0063b1'; // Dark Azure blue steel
  
  // Glass tint based on pod state - prioritize stateColor if present
  const glassTint = isPresencePod
    ? '#9999dd' // Purple tint
    : isSelected
      ? '#ffdd88' // Warm yellow tint
      : stateColor
        ? stateColor // Use state-based color for customers
        : hasAssignment
          ? '#99ddaa' // Green tint
          : '#aaccee'; // Cool blue tint
  
  const podRadius = POD_RADIUS * 0.8;
  const frameThickness = 0.025;
  const strutCount = 6;

  return (
    <group position={position} onClick={onClick} onDoubleClick={onDoubleClick}>
      {/* Glass walls - fully transparent cylinder */}
      <mesh>
        <cylinderGeometry args={[podRadius, podRadius, POD_HEIGHT, 6, 1, true]} />
        <meshStandardMaterial 
          color={glassTint}
          transparent
          opacity={(stateColor ? 0.4 : 0.2) * opacity}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
          envMapIntensity={1}
        />
      </mesh>
      
      {/* Glass roof */}
      <mesh position={[0, POD_HEIGHT / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[podRadius - frameThickness, 6]} />
        <meshStandardMaterial 
          color={glassTint}
          transparent
          opacity={0.25 * opacity}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Interior floor */}
      <mesh position={[0, -POD_HEIGHT / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[podRadius * 0.95, 6]} />
        <meshStandardMaterial 
          color="#e8e8e8"
          metalness={0.2}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Bottom steel frame ring */}
      <mesh position={[0, -POD_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[podRadius, frameThickness, 8, 6]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Top steel frame ring */}
      <mesh position={[0, POD_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[podRadius, frameThickness, 8, 6]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Middle steel frame ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[podRadius + 0.005, frameThickness * 0.7, 8, 6]} />
        <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Vertical steel struts at each hex corner */}
      {Array.from({ length: strutCount }).map((_, idx) => {
        const angle = (idx / strutCount) * Math.PI * 2 + Math.PI / strutCount;
        const x = Math.sin(angle) * podRadius;
        const z = Math.cos(angle) * podRadius;
        return (
          <mesh key={idx} position={[x, 0, z]}>
            <cylinderGeometry args={[frameThickness, frameThickness, POD_HEIGHT, 8]} />
            <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.3} />
          </mesh>
        );
      })}
      
      {/* Humanoid skeleton figure inside pod - only when person/agent assigned */}
      {hasHumanoid && (
        <HumanoidSkeleton position={[0, -POD_HEIGHT / 2 + 0.05, 0]} scale={0.8} color={frameColor} faceAngle={faceAngle} />
      )}
      
      {/* Selection highlight ring */}
      {isSelected && (
        <mesh position={[0, -POD_HEIGHT / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[podRadius + 0.05, podRadius + 0.15, 6]} />
          <meshStandardMaterial 
            color="#ffbb00" 
            emissive="#ffbb00"
            emissiveIntensity={0.8}
            transparent 
            opacity={0.9}
          />
        </mesh>
      )}
      
      {/* State color ring at base - visible indicator for customer state */}
      {stateColor && !isSelected && (
        <mesh position={[0, -POD_HEIGHT / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[podRadius + 0.02, podRadius + 0.12, 6]} />
          <meshStandardMaterial 
            color={stateColor} 
            emissive={stateColor}
            emissiveIntensity={0.6}
            transparent 
            opacity={0.85}
          />
        </mesh>
      )}
      
      {isPresencePod && (
        <group position={[0, POD_HEIGHT * 0.9, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 0.3, 0.05]} />
            <meshStandardMaterial color="#6264a7" transparent opacity={0.9} />
          </mesh>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            MY LOCATION
          </Text>
        </group>
      )}
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
  onPodDoubleClick,
  hidePresencePod = false,
  useLOD = false,
}: {
  ring: Ring;
  floorY: number;
  TowerX: number;
  TowerZ: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
  onPodDoubleClick?: (podId: number) => void;
  hidePresencePod?: boolean;
  useLOD?: boolean;
}) {
  const pods = ring.pods || [];
  const radius = ring.radiusIndex * 2;

  return (
    <group>
      {pods.map((pod) => {
        // Hide presence pod when navigating (it will be rendered at nav position)
        if (hidePresencePod && pod.podId === presencePodId) {
          return null;
        }
        let x: number, z: number;
        let podAngle = 0;
        if (pod.slotIndex === -1) {
          // Center pod
          x = TowerX;
          z = TowerZ;
        } else {
          const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
          x = TowerX + radius * Math.cos(angle);
          z = TowerZ + radius * Math.sin(angle);
          // Face inward: rotate to look toward center (opposite of outward angle)
          podAngle = -angle - Math.PI / 2;
        }
        const hasAssignment = (pod.assignments?.length ?? 0) > 0;
        const isPresence = presencePodId === pod.podId;
        const isSelected = selectedPodId === pod.podId;
        
        // Get state color from first Customer assignment
        const customerAssignment = (pod.assignments || []).find(
          (a) => a.entity?.entityType === 'Customer' && a.entity?.content
        );
        let stateColor: string | null = null;
        if (customerAssignment?.entity?.content) {
          try {
            const content = JSON.parse(customerAssignment.entity.content);
            if (content.state) {
              stateColor = getStateColor(content.state);
            }
          } catch {
            // ignore parse errors
          }
        }
        
        // Use simplified mesh for LOD mode (many pods)
        if (useLOD && !isSelected && !isPresence) {
          return (
            <SimplePodMesh
              key={pod.podId}
              position={[x, floorY + POD_HEIGHT / 2, z]}
              isSelected={false}
              hasAssignment={hasAssignment}
              onClick={() => onPodSelect(pod.podId)}
              isPresencePod={false}
              stateColor={stateColor}
            />
          );
        }
        
        const hasHumanoid = (pod.assignments || []).some(
          (a) => a.entity?.entityType === 'User' || a.entity?.entityType === 'Agent'
        );
        const isDimmed = dimPodId === pod.podId;
        
        return (
          <PodMesh
            key={pod.podId}
            position={[x, floorY + POD_HEIGHT / 2, z]}
            isSelected={isSelected}
            hasAssignment={hasAssignment}
            hasHumanoid={hasHumanoid}
            faceAngle={podAngle}
            onClick={() => onPodSelect(pod.podId)}
            onDoubleClick={() => onPodDoubleClick?.(pod.podId)}
            isPresencePod={isPresence}
            opacity={isDimmed ? 0.2 : 1}
            stateColor={stateColor}
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
  onPodDoubleClick,
  hidePresencePod = false,
  useLOD = false,
}: {
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
}) {
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
  onPodDoubleClick,
  hidePresencePod = false,
}: {
  Tower: Tower;
  floors: Floor[];
  position: TowerPosition;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
  presencePodId?: number | null;
  dimPodId?: number | null;
  onPodDoubleClick?: (podId: number) => void;
  hidePresencePod?: boolean;
}) {
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
  /** Request to focus camera on selected pod */
  focusRequest?: { nonce: number } | null;
  /** Callback when navigation state changes - passes state and action handler for HUD rendering */
  onNavigationStateChange?: (state: NavigationState | null, handleAction: ((action: NavAction) => void) | null) => void;
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
  focusRequest,
  onNavigationStateChange,
}) => {
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>(INITIAL_CAMERA_POSITION);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    autoRotate: false,
    showFloorGrid: false,
  });

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

  // Camera animation state for smooth focus transitions
  const [cameraAnimation, setCameraAnimation] = useState<{
    from: Vec3;
    to: Vec3;
    startTime: number;
    duration: number;
  } | null>(null);
  const [previousCameraPosition, setPreviousCameraPosition] = useState<Vec3 | null>(null);

  const navStateRef = useRef({
    position: INITIAL_CAMERA_POSITION as Vec3,
    yawStep: 0,
    pitchStep: 0,
  });

  const orbitControlsRef = useRef<OrbitControlsImpl>(null);

  // Place towers in a hexagonal (honeycomb) grid instead of a single line.
  const TowerPositions = useMemo(() => {
    const positions: Record<number, TowerPosition> = {};
    if (towers.length === 0) return positions;

    // Sort towers by orderIndex to ensure correct hex grid placement
    // Tower with orderIndex 0 -> center, 1-6 -> ring 1, 7-18 -> ring 2, etc.
    const sortedTowers = [...towers].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    // Use a conservative uniform spacing based on the largest Tower footprint.
    let maxTowerRadiusWorld = 1;
    for (const Tower of sortedTowers) {
      const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
      maxTowerRadiusWorld = Math.max(maxTowerRadiusWorld, getTowerMaxRadius(TowerFloors) * FLOOR_RADIUS_SCALE);
    }

    const minCenterDist = 2 * maxTowerRadiusWorld + Tower_GAP;
    const hexSize = minCenterDist / Math.sqrt(3); // adjacent center distance is sqrt(3)*size

    const axialCoords = generateHexSpiralCoords(sortedTowers.length);

    for (let idx = 0; idx < sortedTowers.length; idx++) {
      const Tower = sortedTowers[idx];
      const { q, r } = axialCoords[idx];
      const x = hexSize * Math.sqrt(3) * (q + r / 2);
      const z = hexSize * (3 / 2) * r;
      positions[Tower.towerId] = { x, z };
    }

    return positions;
  }, [towers, floors]);

  // Calculate hexSize for road network (same formula as TowerPositions)
  const hexSize = useMemo(() => {
    if (towers.length === 0) return 1;
    let maxTowerRadiusWorld = 1;
    for (const tower of towers) {
      const towerFloors = floors.filter((f) => f.towerId === tower.towerId);
      maxTowerRadiusWorld = Math.max(maxTowerRadiusWorld, getTowerMaxRadius(towerFloors) * FLOOR_RADIUS_SCALE);
    }
    const minCenterDist = 2 * maxTowerRadiusWorld + Tower_GAP;
    return minCenterDist / Math.sqrt(3);
  }, [towers, floors]);

  // Road network for pod navigation
  const { roads, boundaries } = useRoadNetwork({
    towers,
    floors,
    hexSize,
    floorRadiusScale: FLOOR_RADIUS_SCALE,
    floorSpacing: FLOOR_SPACING,
  });

  // Pod navigation state
  const [podNavState, setPodNavState] = useState<NavigationState>({
    ...DEFAULT_NAVIGATION_STATE,
  });
  const podNavStateRef = useRef<NavigationState>(podNavState);
  podNavStateRef.current = podNavState;

  // Get presence pod position for starting navigation
  const presencePodInfo = useMemo<{ position: Vec3; towerId: number; floorIndex: number } | null>(() => {
    if (!presencePodId) return null;
    for (const floor of floors) {
      for (const ring of floor.rings || []) {
        for (const pod of ring.pods || []) {
          if (pod.podId === presencePodId) {
            const towerPos = TowerPositions[floor.towerId] ?? { x: 0, z: 0 };
            const floorsInTower = floors.filter((f) => f.towerId === floor.towerId);
            const sortedFloors = [...floorsInTower].sort((a, b) => a.orderIndex - b.orderIndex);
            const floorIndex = sortedFloors.findIndex((f) => f.floorId === floor.floorId);
            const floorY = (floorIndex >= 0 ? floorIndex : 0) * FLOOR_SPACING;
            
            const radius = ring.radiusIndex * 2;
            let x: number, z: number;
            if (pod.slotIndex === -1) {
              x = towerPos.x;
              z = towerPos.z;
            } else {
              const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
              x = towerPos.x + radius * Math.cos(angle);
              z = towerPos.z + radius * Math.sin(angle);
            }
            return {
              position: [x, floorY + POD_HEIGHT / 2, z] as Vec3,
              towerId: floor.towerId,
              floorIndex: floorIndex >= 0 ? floorIndex : 0,
            };
          }
        }
      }
    }
    return null;
  }, [presencePodId, floors, TowerPositions]);

  // Backwards-compatible alias
  const presencePodPosition = presencePodInfo?.position ?? null;

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

  // Smooth camera focus with easing
  const focusOnPosition = useCallback((targetPos: Vec3, distance: number = 10) => {
    setPreviousCameraPosition(cameraPosition);
    const offset: Vec3 = [0, distance * 0.4, distance * 0.8];
    const newPos: Vec3 = [
      targetPos[0] + offset[0],
      targetPos[1] + offset[1],
      targetPos[2] + offset[2],
    ];
    setCameraAnimation({
      from: cameraPosition,
      to: newPos,
      startTime: Date.now(),
      duration: 800, // ms
    });
  }, [cameraPosition]);

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

  // Handle focus request - zoom camera to selected pod
  useEffect(() => {
    if (!focusRequest || !selectedPodId) return;
    const info = findPodSceneInfo(selectedPodId);
    if (info) {
      focusOnPosition(info.origin, 8);
    }
  }, [focusRequest?.nonce]);

  // Pod navigation action handler
  const handlePodNavAction = useCallback((action: NavAction) => {
    const state = podNavStateRef.current;
    
    switch (action) {
      case 'toggle-nav':
        if (state.active) {
          // Exit pod navigation
          setPodNavState(s => ({ ...s, active: false }));
          setNavigationMode(false);
        } else if (presencePodInfo) {
          // Enter pod navigation from presence pod
          // Start inside the tower at the presence pod's floor
          setPodNavState({
            ...DEFAULT_NAVIGATION_STATE,
            active: true,
            position: presencePodInfo.position as NavVec3,
            inTowerId: presencePodInfo.towerId,
            currentFloor: presencePodInfo.floorIndex,
            currentRoad: null,
            roadProgress: 0,
          });
          setNavigationMode(true);
        }
        break;
        
      case 'exit-nav':
        setPodNavState(s => ({ ...s, active: false }));
        setNavigationMode(false);
        break;
        
      case 'speed-up':
        if (state.verticalMode === 'grounded') {
          setPodNavState(s => ({ ...s, speed: Math.min(5, s.speed + 1) as SpeedLevel }));
        }
        break;
        
      case 'speed-down':
        if (state.verticalMode === 'grounded') {
          setPodNavState(s => ({ ...s, speed: Math.max(0, s.speed - 1) as SpeedLevel }));
        }
        break;
        
      case 'rotate-left':
        setPodNavState(s => {
          const newRot = ((s.podRotation - 1 + 6) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
          return { ...s, podRotation: newRot, movementDirection: (newRot / 6) * Math.PI * 2 };
        });
        break;
        
      case 'rotate-right':
        setPodNavState(s => {
          const newRot = ((s.podRotation + 1) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
          return { ...s, podRotation: newRot, movementDirection: (newRot / 6) * Math.PI * 2 };
        });
        break;
        
      case 'pan-left':
        setPodNavState(s => ({ ...s, cameraPan: (s.cameraPan - 15 + 360) % 360 }));
        break;
        
      case 'pan-right':
        setPodNavState(s => ({ ...s, cameraPan: (s.cameraPan + 15) % 360 }));
        break;
        
      case 'pan-left-fine':
        setPodNavState(s => ({ ...s, cameraPan: (s.cameraPan - 1 + 360) % 360 }));
        break;
        
      case 'pan-right-fine':
        setPodNavState(s => ({ ...s, cameraPan: (s.cameraPan + 1) % 360 }));
        break;
        
      case 'tilt-up':
        setPodNavState(s => ({ ...s, cameraTilt: Math.min(180, s.cameraTilt + 5) }));
        break;
        
      case 'tilt-down':
        setPodNavState(s => ({ ...s, cameraTilt: Math.max(0, s.cameraTilt - 5) }));
        break;
        
      case 'ascend':
        if (state.inTowerId !== null) {
          const boundary = boundaries.find(b => b.towerId === state.inTowerId);
          if (boundary) {
            const maxFloor = Math.floor(boundary.maxFloorY / FLOOR_SPACING);
            if (state.currentFloor >= maxFloor) {
              // At top - trigger ejection
              const connectedRoads = getConnectedRoads(state.inTowerId, roads);
              let ejectionEnd: NavVec3 = [state.position[0], 0, state.position[2] + 10];
              if (connectedRoads.length > 0) {
                const targetRoad = connectedRoads[Math.floor(Math.random() * connectedRoads.length)];
                const landPos = getRoadPosition(targetRoad, 0.5);
                ejectionEnd = landPos;
              }
              setPodNavState(s => ({
                ...s,
                verticalMode: 'ejected',
                ejectionProgress: 0,
                ejectionStart: [...s.position] as NavVec3,
                ejectionEnd,
              }));
            } else if (state.verticalMode !== 'ascending') {
              setPodNavState(s => ({ ...s, verticalMode: 'ascending' }));
            }
          }
        }
        break;
        
      case 'descend':
        if (state.inTowerId !== null && state.verticalMode !== 'ejected') {
          if (state.currentFloor <= 0) {
            // Exit tower to road
            const closestRoad = findClosestRoad(state.position, roads);
            setPodNavState(s => ({
              ...s,
              inTowerId: null,
              verticalMode: 'grounded',
              currentRoad: closestRoad?.road || null,
              roadProgress: closestRoad?.progress || 0,
            }));
          } else if (state.verticalMode !== 'descending') {
            setPodNavState(s => ({ ...s, verticalMode: 'descending' }));
          }
        }
        break;
        
      case 'camera-slot-1':
        setPodNavState(s => ({ ...s, cameraSlot: 0 }));
        break;
      case 'camera-slot-2':
        setPodNavState(s => ({ ...s, cameraSlot: 1 }));
        break;
      case 'camera-slot-3':
        setPodNavState(s => ({ ...s, cameraSlot: 2 }));
        break;
      case 'camera-slot-4':
        setPodNavState(s => ({ ...s, cameraSlot: 3 }));
        break;
      case 'camera-slot-5':
        setPodNavState(s => ({ ...s, cameraSlot: 4 }));
        break;
      case 'camera-slot-6':
        setPodNavState(s => ({ ...s, cameraSlot: 5 }));
        break;
      case 'camera-slot-7':
        setPodNavState(s => ({ ...s, cameraSlot: 6 }));
        break;
        
      case 'height-up':
        setPodNavState(s => ({ ...s, cameraHeight: Math.min(4, s.cameraHeight + 1) as CameraHeight }));
        break;
        
      case 'height-down':
        setPodNavState(s => ({ ...s, cameraHeight: Math.max(0, s.cameraHeight - 1) as CameraHeight }));
        break;
        
      case 'reset-camera':
        setPodNavState(s => ({ ...s, cameraSlot: 0, cameraHeight: 2, cameraPan: 0, cameraTilt: 90 }));
        break;
    }
  }, [presencePodInfo, roads, boundaries]);

  // Notify parent when navigation state changes (for HUD rendering in parent)
  useEffect(() => {
    if (podNavState.active) {
      onNavigationStateChange?.(podNavState, handlePodNavAction);
    } else {
      onNavigationStateChange?.(null, null);
    }
  }, [podNavState, onNavigationStateChange, handlePodNavAction]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Check for pod navigation actions first
      if (podNavState.active || event.key === 'n' || event.key === 'N') {
        const action = NAV_KEY_BINDINGS[event.key];
        if (action) {
          event.preventDefault();
          handlePodNavAction(action);
          return;
        }
      }

      // Original navigation mode toggle
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        if (!presencePodPosition) {
          // Can't enter pod nav without presence
          console.warn('Set presence in a pod first to use pod navigation');
          return;
        }
        setNavigationMode((v) => !v);
      }
      if (event.key === 'Escape') {
        setNavigationMode(false);
        setPodNavState(s => ({ ...s, active: false }));
      }
      if (event.key === 'p' || event.key === 'P') {
        onRequestProcessSelected?.();
      }
      if (!podNavState.active) {
        if (event.key === 'f' || event.key === 'F') {
          event.preventDefault();
          if (selectedPodId) {
            const info = findPodSceneInfo(selectedPodId);
            if (info) {
              focusOnPosition(info.origin);
            }
          }
        }
        if (event.key === 'b' || event.key === 'B') {
          event.preventDefault();
          if (previousCameraPosition) {
            setCameraAnimation({
              from: cameraPosition,
              to: previousCameraPosition,
              startTime: Date.now(),
              duration: 800,
            });
            setPreviousCameraPosition(null);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRequestProcessSelected, selectedPodId, previousCameraPosition, findPodSceneInfo, focusOnPosition, cameraPosition, podNavState.active, presencePodPosition, handlePodNavAction]);

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
        const stepAngle = Math.PI / 24; // ~7.5 degrees per step (much finer control)
        const maxPitchSteps = 12; // Allow wider pitch range with smaller steps

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
            move([-forward[0], -forward[1], -forward[2]]);
            break;
          case 's':
          case 'S':
            event.preventDefault();
            move(forward);
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
            // In navigation mode, F moves down, not focus
            if (navigationMode) {
              event.preventDefault();
              move([0, -1, 0]);
            }
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
      // Sync navStateRef position with current camera position when entering navigation mode
      navStateRef.current.position = [camera.position.x, camera.position.y, camera.position.z];
      gl.domElement.style.cursor = 'crosshair';
      return () => {
        gl.domElement.style.cursor = 'default';
      };
    }, [navigationMode, gl.domElement, camera]);

    // Ref to track navigation active state for mouse control without re-running effect
    const podNavActiveRef = useRef(podNavState.active);
    podNavActiveRef.current = podNavState.active;

    // Mouse control for pod navigation pan/tilt
    useEffect(() => {
      // Only set up mouse control once, use ref to check active state
      gl.domElement.style.cursor = podNavActiveRef.current ? 'crosshair' : 'default';
      
      let isPointerLocked = false;
      
      const onMouseMove = (event: MouseEvent) => {
        if (!isPointerLocked || !podNavActiveRef.current) return;
        
        const sensitivity = 0.15;
        const deltaX = event.movementX * sensitivity;
        const deltaY = event.movementY * sensitivity;
        
        setPodNavState(s => ({
          ...s,
          cameraPan: (s.cameraPan + deltaX + 360) % 360,
          cameraTilt: Math.max(0, Math.min(180, s.cameraTilt - deltaY)),
        }));
      };
      
      const onPointerLockChange = () => {
        isPointerLocked = document.pointerLockElement === gl.domElement;
        gl.domElement.style.cursor = isPointerLocked ? 'none' : (podNavActiveRef.current ? 'crosshair' : 'default');
      };
      
      const onClick = () => {
        if (!isPointerLocked && podNavActiveRef.current) {
          gl.domElement.requestPointerLock();
        }
      };
      
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isPointerLocked) {
          document.exitPointerLock();
        }
      };
      
      gl.domElement.addEventListener('click', onClick);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('pointerlockchange', onPointerLockChange);
      window.addEventListener('keydown', onKeyDown);
      
      return () => {
        gl.domElement.removeEventListener('click', onClick);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        window.removeEventListener('keydown', onKeyDown);
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock();
        }
        gl.domElement.style.cursor = 'default';
      };
    }, [gl.domElement]);

    useFrame((_, delta) => {
      // Camera animation for smooth focus transitions
      if (cameraAnimation && !navigationMode) {
        const elapsed = Date.now() - cameraAnimation.startTime;
        const t = Math.min(1, elapsed / cameraAnimation.duration);
        // Easing function (ease-out cubic)
        const eased = 1 - Math.pow(1 - t, 3);
        
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const newPos: Vec3 = [
          lerp(cameraAnimation.from[0], cameraAnimation.to[0], eased),
          lerp(cameraAnimation.from[1], cameraAnimation.to[1], eased),
          lerp(cameraAnimation.from[2], cameraAnimation.to[2], eased),
        ];
        
        camera.position.set(...newPos);
        if (orbitControlsRef.current) {
          orbitControlsRef.current.update();
        }
        
        if (t >= 1) {
          setCameraAnimation(null);
          setCameraPosition(newPos);
        }
      }

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

      // Pod navigation mode tick
      if (podNavState.active) {
        const state = podNavStateRef.current;
        const speed = SPEED_VALUES[state.speed as SpeedLevel];
        
        // Handle different movement modes
        if (state.verticalMode === 'grounded' && state.currentRoad && speed > 0) {
          // Moving along road
          const roadLength = Math.sqrt(
            Math.pow(state.currentRoad.toWorld[0] - state.currentRoad.fromWorld[0], 2) +
            Math.pow(state.currentRoad.toWorld[2] - state.currentRoad.fromWorld[2], 2)
          );
          
          const progressDelta = (speed * delta) / roadLength;
          
          // Determine movement direction based on pod rotation
          const roadAngle = Math.atan2(
            state.currentRoad.toWorld[0] - state.currentRoad.fromWorld[0],
            state.currentRoad.toWorld[2] - state.currentRoad.fromWorld[2]
          );
          const podAngle = (state.podRotation / 6) * Math.PI * 2;
          
          // Check if moving forward or backward along road
          const angleDiff = Math.abs(((roadAngle - podAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const movingForward = angleDiff < Math.PI / 2;
          
          let newProgress = state.roadProgress;
          if (movingForward) {
            newProgress = Math.min(1, state.roadProgress + progressDelta);
          } else {
            newProgress = Math.max(0, state.roadProgress - progressDelta);
          }
          
          // Update position
          const newPos = getRoadPosition(state.currentRoad, newProgress);
          const updatedPos: NavVec3 = [newPos[0], POD_HEIGHT / 2, newPos[2]];
          
          // Check if entering a tower boundary - only at road endpoints
          // This prevents re-entering the tower we just left
          const nearStart = newProgress <= 0.1;
          const nearEnd = newProgress >= 0.9;
          const movingToStart = !movingForward && nearStart;
          const movingToEnd = movingForward && nearEnd;
          
          let enteredTower: TowerBoundary | null = null;
          if (movingToStart) {
            enteredTower = boundaries.find(b => b.towerId === state.currentRoad!.fromTowerId) || null;
          } else if (movingToEnd) {
            enteredTower = boundaries.find(b => b.towerId === state.currentRoad!.toTowerId) || null;
          }
          
          if (enteredTower) {
            setPodNavState(s => ({
              ...s,
              position: updatedPos,
              roadProgress: newProgress,
              inTowerId: enteredTower!.towerId,
              currentFloor: 0,
              speed: 0,
              currentRoad: null,
            }));
          } else if (newProgress >= 1 || newProgress <= 0) {
            // Reached end of road - transition to connected road
            const atTowerId = newProgress >= 1 
              ? state.currentRoad.toTowerId 
              : state.currentRoad.fromTowerId;
            
            const connectedRoads = getConnectedRoads(atTowerId, roads)
              .filter(r => r.id !== state.currentRoad!.id);
            
            if (connectedRoads.length > 0) {
              // Pick road closest to current direction
              let bestRoad = connectedRoads[0];
              let bestAngleDiff = Infinity;
              
              for (const road of connectedRoads) {
                const rAngle = Math.atan2(
                  road.toWorld[0] - road.fromWorld[0],
                  road.toWorld[2] - road.fromWorld[2]
                );
                const diff = Math.abs(((rAngle - podAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                if (diff < bestAngleDiff) {
                  bestAngleDiff = diff;
                  bestRoad = road;
                }
              }
              
              // Start from the tower end
              const nextProgress = bestRoad.fromTowerId === atTowerId ? 0 : 1;
              setPodNavState(s => ({
                ...s,
                position: updatedPos,
                currentRoad: bestRoad,
                roadProgress: nextProgress,
              }));
            } else {
              setPodNavState(s => ({
                ...s,
                position: updatedPos,
                roadProgress: newProgress,
              }));
            }
          } else {
            setPodNavState(s => ({
              ...s,
              position: updatedPos,
              roadProgress: newProgress,
            }));
          }
        } else if (state.verticalMode === 'ascending') {
          // Ascending to next floor
          const targetY = (state.currentFloor + 1) * FLOOR_SPACING + POD_HEIGHT / 2;
          const currentY = state.position[1];
          const ascentSpeed = 3;
          
          const newY = Math.min(targetY, currentY + ascentSpeed * delta);
          const updatedPos: NavVec3 = [state.position[0], newY, state.position[2]];
          
          if (newY >= targetY) {
            setPodNavState(s => ({
              ...s,
              position: [s.position[0], targetY, s.position[2]],
              currentFloor: s.currentFloor + 1,
              verticalMode: 'grounded',
            }));
          } else {
            setPodNavState(s => ({ ...s, position: updatedPos }));
          }
        } else if (state.verticalMode === 'descending') {
          // Descending to previous floor
          const targetY = (state.currentFloor - 1) * FLOOR_SPACING + POD_HEIGHT / 2;
          const currentY = state.position[1];
          const descentSpeed = 3;
          
          const newY = Math.max(targetY, currentY - descentSpeed * delta);
          const updatedPos: NavVec3 = [state.position[0], newY, state.position[2]];
          
          if (newY <= targetY) {
            setPodNavState(s => ({
              ...s,
              position: [s.position[0], targetY, s.position[2]],
              currentFloor: s.currentFloor - 1,
              verticalMode: 'grounded',
            }));
          } else {
            setPodNavState(s => ({ ...s, position: updatedPos }));
          }
        } else if (state.verticalMode === 'ejected' && state.ejectionStart && state.ejectionEnd) {
          // Parabolic ejection arc
          const ejectionDuration = 3;
          const newProgress = Math.min(1, state.ejectionProgress + delta / ejectionDuration);
          
          const arcPos = parabolicLerp(
            state.ejectionStart,
            state.ejectionEnd,
            newProgress,
            state.ejectionPeakHeight
          );
          
          if (newProgress >= 1) {
            // Landed
            const closestRoad = findClosestRoad(state.ejectionEnd, roads);
            setPodNavState(s => ({
              ...s,
              position: [s.ejectionEnd![0], POD_HEIGHT / 2, s.ejectionEnd![2]],
              verticalMode: 'grounded',
              inTowerId: null,
              currentFloor: 0,
              ejectionStart: null,
              ejectionEnd: null,
              ejectionProgress: 0,
              currentRoad: closestRoad?.road || null,
              roadProgress: closestRoad?.progress || 0,
            }));
          } else {
            setPodNavState(s => ({
              ...s,
              position: arcPos,
              ejectionProgress: newProgress,
            }));
          }
        }
        
        // Update camera position and rotation for pod navigation
        const camState = podNavStateRef.current;
        
        // Height offset: 5 levels evenly spaced from floor to ceiling
        const heightRatio = camState.cameraHeight / 4;
        const heightOffset = POD_HEIGHT * 0.1 + (POD_HEIGHT * 0.8) * heightRatio;
        
        // Slot offset: 0 = center, 1-6 = toward each hex face
        let slotOffsetX = 0;
        let slotOffsetZ = 0;
        
        if (camState.cameraSlot > 0) {
          const slotAngle = ((camState.cameraSlot - 1) / 6) * Math.PI * 2;
          const podRotationAngle = (camState.podRotation / 6) * Math.PI * 2;
          const totalAngle = slotAngle + podRotationAngle;
          
          const slotDistance = POD_RADIUS * 0.5;
          slotOffsetX = Math.sin(totalAngle) * slotDistance;
          slotOffsetZ = Math.cos(totalAngle) * slotDistance;
        }
        
        const camPos: Vec3 = [
          camState.position[0] + slotOffsetX,
          camState.position[1] + heightOffset,
          camState.position[2] + slotOffsetZ,
        ];
        
        const podRotationRad = (camState.podRotation / 6) * Math.PI * 2;
        const panRad = (camState.cameraPan / 180) * Math.PI;
        const tiltRad = ((camState.cameraTilt - 90) / 180) * Math.PI;
        
        camera.position.set(...camPos);
        camera.rotation.order = 'YXZ';
        camera.rotation.set(-tiltRad, podRotationRad + panRad, 0);
        camera.updateProjectionMatrix();
        
        return;
      }

      // Original navigation camera tick (legacy mode)
      if (navigationMode && !podNavState.active) {
        const stepAngle = Math.PI / 24; // ~7.5 degrees per step
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
        {/* Player pod during pod navigation - rendered at navigation position */}
        {podNavState.active && (
          <PodMesh
            position={podNavState.position as Vec3}
            isSelected={false}
            hasAssignment={true}
            onClick={() => {}}
            isPresencePod={true}
            opacity={1}
          />
        )}
      </>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* 3D View */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, height: '100%', backgroundColor: '#e6f2ff' }}>
        <Canvas camera={{ position: cameraPosition, fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={['#e6f2ff']} />
          {!navigationMode && (
            <OrbitControls
              ref={orbitControlsRef}
              makeDefault
              enablePan
              enableZoom
              enableRotate
              minDistance={5}
              maxDistance={200}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
              enableDamping
              dampingFactor={0.15}
              rotateSpeed={0.35}
              panSpeed={0.5}
              zoomSpeed={0.7}
              autoRotate={settings.autoRotate}
              autoRotateSpeed={0.5}
            />
          )}
          <ambientLight intensity={0.7} />
          <hemisphereLight intensity={0.4} color="#b3d9ff" groundColor="#e6f2ff" />
          <directionalLight 
            position={[10, 20, 10]} 
            intensity={0.8} 
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={50}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          {/* Architectural accent spotlights per tower */}
          {towers.map((tower) => {
            const towerFloors = floors.filter(f => f.towerId === tower.towerId);
            const maxFloors = towerFloors.length || 1;
            const lightY = maxFloors * FLOOR_SPACING + 5;
            const pos = TowerPositions[tower.towerId] || { x: 0, z: 0 };
            return (
              <spotLight
                key={`light-${tower.towerId}`}
                position={[pos.x, lightY, pos.z]}
                angle={0.6}
                penumbra={0.8}
                intensity={0.3}
                distance={lightY + 5}
                target-position={[pos.x, 0, pos.z]}
              />
            );
          })}
          {settings.showFloorGrid && (
            <HexagonalGrid 
              size={50} 
              hexRadius={2} 
              color="#b3d4e8" 
              towerPositions={TowerPositions}
              floors={floors}
            />
          )}
          
          {/* Road network connecting towers */}
          <RoadNetwork roads={roads} visible={true} />

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
                    onPodDoubleClick={(podId) => {
                      const info = findPodSceneInfo(podId);
                      if (info) {
                        focusOnPosition(info.origin);
                      }
                    }}
                  />
                );
              })}
            </group>
          </Bounds>
        </Canvas>
      </div>
      {/* Settings panel - always visible on the side */}
      {showSettings && (
        <div style={{ 
          width: 400, 
          padding: 20, 
          backgroundColor: 'rgba(255, 255, 255, 0.9)', 
          borderLeft: '1px solid #d1d1d1',
          height: '100%',
          boxShadow: '2px 0 5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <h2 style={{ fontSize: 18, margin: 0, color: '#0063b1' }}>Layout Settings</h2>
          <label style={{ fontSize: 14, color: '#333' }}>
            <input 
              type="checkbox" 
              checked={settings.autoRotate} 
              onChange={(e) => setSettings(s => ({ ...s, autoRotate: e.target.checked }))}
              style={{ marginRight: 10 }}
            />
            Auto Rotate
          </label>
          <label style={{ fontSize: 14, color: '#333' }}>
            <input 
              type="checkbox" 
              checked={settings.showFloorGrid} 
              onChange={(e) => setSettings(s => ({ ...s, showFloorGrid: e.target.checked }))}
              style={{ marginRight: 10 }}
            />
            Show Floor Grid
          </label>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowSettings(false)}
            style={{
              padding: '10px 15px',
              backgroundColor: '#0063b1',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              transition: 'background-color 0.3s',
            }}
          >
            Close Settings
          </button>
        </div>
      )}
    </div>
  );
}