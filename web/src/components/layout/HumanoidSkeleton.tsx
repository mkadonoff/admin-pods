import React from 'react';

export interface HumanoidSkeletonProps {
  position: [number, number, number];
  scale?: number;
  color?: string;
  faceAngle?: number;
}

// Humanoid skeleton figure sitting at desk with 6 segments (head, torso, 2 arms, 2 legs)
export const HumanoidSkeleton: React.FC<HumanoidSkeletonProps> = ({
  position,
  scale = 1,
  color = '#0063b1',
  faceAngle = 0,
}) => {
  const segmentRadius = 0.03 * scale;
  const headRadius = 0.12 * scale;
  const torsoHeight = 0.5 * scale;
  const upperLegLength = 0.3 * scale;
  const lowerLegLength = 0.3 * scale;
  const upperArmLength = 0.15 * scale;
  const forearmLength = 0.18 * scale;
  const shoulderWidth = 0.08 * scale;
  
  // Sitting position - chair/desk heights
  const seatHeight = 0.25 * scale;
  const limbGap = 0.05 * scale;
  const deskDepth = 0.3 * scale;
  const deskWidth = 0.5 * scale;
  const deskZ = 0.25 * scale;
  
  // Body positions (sitting)
  const hipY = seatHeight + limbGap;
  const torsoY = hipY + torsoHeight / 2;
  const headY = torsoY + torsoHeight / 2 + headRadius * 0.8;
  const shoulderY = torsoY + torsoHeight / 2 - 0.08 * scale;
  const elbowY = shoulderY - upperArmLength;
  const deskHeight = elbowY - limbGap;
  
  return (
    <group position={position} rotation={[0, faceAngle, 0]}>
      {/* Desk */}
      <mesh position={[0, deskHeight, deskZ]}>
        <boxGeometry args={[deskWidth, 0.03 * scale, deskDepth]} />
        <meshStandardMaterial color="#5a4a3a" metalness={0.2} roughness={0.8} />
      </mesh>
      
      {/* Chair seat */}
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
      
      {/* Left arm */}
      {(() => {
        const upperArmStartY = shoulderY;
        const upperArmAngle = 0.15;
        const elbowY = upperArmStartY - upperArmLength;
        const elbowZ = 0.02 * scale;
        return (
          <>
            <mesh position={[-shoulderWidth, upperArmStartY - upperArmLength / 2, elbowZ / 2]} rotation={[upperArmAngle, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, upperArmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[-shoulderWidth, elbowY, elbowZ + forearmLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, forearmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
          </>
        );
      })()}
      
      {/* Right arm */}
      {(() => {
        const upperArmStartY = shoulderY;
        const upperArmAngle = 0.15;
        const elbowY = upperArmStartY - upperArmLength;
        const elbowZ = 0.02 * scale;
        return (
          <>
            <mesh position={[shoulderWidth, upperArmStartY - upperArmLength / 2, elbowZ / 2]} rotation={[upperArmAngle, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, upperArmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[shoulderWidth, elbowY, elbowZ + forearmLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[segmentRadius, segmentRadius, forearmLength, 8]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
          </>
        );
      })()}
      
      {/* Left leg */}
      <mesh position={[-0.08 * scale, hipY, upperLegLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, upperLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.08 * scale, hipY / 2, upperLegLength]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, lowerLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Right leg */}
      <mesh position={[0.08 * scale, hipY, upperLegLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, upperLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.08 * scale, hipY / 2, upperLegLength]}>
        <cylinderGeometry args={[segmentRadius, segmentRadius, lowerLegLength, 8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
};
