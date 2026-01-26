import React from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { POD_RADIUS, POD_HEIGHT } from './constants';
import { HumanoidSkeleton } from './HumanoidSkeleton';

export interface PodMeshProps {
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
}

// 3D Pod component with glass and steel frame
export const PodMesh: React.FC<PodMeshProps> = ({
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
}) => {
  // Accent color for the steel frame - Azure-themed metallic blue
  const frameColor = '#0063b1';
  
  // Glass tint based on pod state - prioritize stateColor if present
  const glassTint = isPresencePod
    ? '#9999dd'
    : isSelected
      ? '#ffdd88'
      : stateColor
        ? stateColor
        : hasAssignment
          ? '#99ddaa'
          : '#aaccee';
  
  const podRadius = POD_RADIUS * 0.8;
  const frameThickness = 0.025;
  const strutCount = 6;

  return (
    <group position={position} onClick={onClick} onDoubleClick={onDoubleClick}>
      {/* Glass walls */}
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
      
      {/* Humanoid skeleton figure inside pod */}
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
      
      {/* State color ring at base */}
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
};
