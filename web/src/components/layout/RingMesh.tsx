import React from 'react';
import { Ring, getStateColor } from '../../api';
import { POD_HEIGHT } from './constants';
import { PodMesh } from './PodMesh';
import { SimplePodMesh } from './SimplePodMesh';

export interface RingMeshProps {
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
}

// 3D Ring component - renders pods in a circle
export const RingMesh: React.FC<RingMeshProps> = ({
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
}) => {
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
          // Face inward: rotate to look toward center
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
};
