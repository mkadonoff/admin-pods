/**
 * Pod Navigation Hook
 * 
 * Main navigation controller for pod-based movement in the 3D environment.
 * Handles road movement, tower ascension, parabolic ejection, and camera controls.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Vec3,
  NavigationState,
  DEFAULT_NAVIGATION_STATE,
  SPEED_VALUES,
  SpeedLevel,
  CameraSlot,
  CameraHeight,
  RoadSegment,
  TowerBoundary,
  NavAction,
  NAV_KEY_BINDINGS,
  parabolicLerp,
} from './PodNavigationTypes';
import {
  findClosestRoad,
  findTowerAtPosition,
  getRoadPosition,
  getConnectedRoads,
} from './useRoadNetwork';

interface UsePodNavigationProps {
  /** Whether navigation mode is active */
  active: boolean;
  /** Starting pod world position (from presence pod) */
  startPosition: Vec3;
  /** All road segments */
  roads: RoadSegment[];
  /** All tower boundaries */
  boundaries: TowerBoundary[];
  /** Pod radius constant */
  podRadius: number;
  /** Pod height constant */
  podHeight: number;
  /** Floor spacing constant */
  floorSpacing: number;
  /** Callback when navigation state changes */
  onStateChange?: (state: NavigationState) => void;
  /** Callback when exiting navigation */
  onExit?: () => void;
}

interface PodNavigationResult {
  /** Current navigation state */
  state: NavigationState;
  /** Handle keyboard action */
  handleAction: (action: NavAction) => void;
  /** Current camera world position */
  cameraPosition: Vec3;
  /** Current camera rotation [yaw, pitch, roll] in radians */
  cameraRotation: Vec3;
  /** Reset navigation to start position */
  reset: () => void;
}

/** Calculate camera position within pod based on slot, height, and pod position/rotation */
function calculateCameraPosition(
  podPosition: Vec3,
  podRotation: number, // 0-5 (60° increments)
  cameraSlot: CameraSlot,
  cameraHeight: CameraHeight,
  podRadius: number,
  podHeight: number,
): Vec3 {
  // Height offset: 5 levels evenly spaced from floor to ceiling
  const heightRatio = cameraHeight / 4; // 0 to 1
  const heightOffset = podHeight * 0.1 + (podHeight * 0.8) * heightRatio; // 10% margin top/bottom
  
  // Slot offset: 0 = center, 1-6 = toward each hex face
  let slotOffsetX = 0;
  let slotOffsetZ = 0;
  
  if (cameraSlot > 0) {
    // Slots 1-6 face the 6 hex directions
    const slotAngle = ((cameraSlot - 1) / 6) * Math.PI * 2;
    const podRotationAngle = (podRotation / 6) * Math.PI * 2;
    const totalAngle = slotAngle + podRotationAngle;
    
    const slotDistance = podRadius * 0.5; // 50% toward wall
    slotOffsetX = Math.sin(totalAngle) * slotDistance;
    slotOffsetZ = Math.cos(totalAngle) * slotDistance;
  }
  
  return [
    podPosition[0] + slotOffsetX,
    podPosition[1] + heightOffset,
    podPosition[2] + slotOffsetZ,
  ];
}

/** Calculate camera rotation from pan, tilt, and pod rotation */
function calculateCameraRotation(
  podRotation: number, // 0-5 (60° increments)
  cameraPan: number,   // 0-359 degrees
  cameraTilt: number,  // 0-180 degrees (90 = level)
): Vec3 {
  const podRotationRad = (podRotation / 6) * Math.PI * 2;
  const panRad = (cameraPan / 180) * Math.PI;
  const tiltRad = ((cameraTilt - 90) / 180) * Math.PI;
  
  return [
    -tiltRad, // pitch (X rotation)
    podRotationRad + panRad, // yaw (Y rotation)
    0, // roll
  ];
}

export function usePodNavigation({
  active,
  startPosition,
  roads,
  boundaries,
  podRadius,
  podHeight,
  floorSpacing,
  onStateChange,
  onExit,
}: UsePodNavigationProps): PodNavigationResult {
  const stateRef = useRef<NavigationState>({
    ...DEFAULT_NAVIGATION_STATE,
    position: startPosition,
    active,
  });
  
  const { camera } = useThree();
  
  // Update active state when prop changes
  useEffect(() => {
    if (active && !stateRef.current.active) {
      // Entering navigation mode - find closest road
      const closestRoad = findClosestRoad(startPosition, roads);
      stateRef.current = {
        ...DEFAULT_NAVIGATION_STATE,
        active: true,
        position: startPosition,
        currentRoad: closestRoad?.road || null,
        roadProgress: closestRoad?.progress || 0,
      };
    } else if (!active && stateRef.current.active) {
      stateRef.current.active = false;
    }
  }, [active, startPosition, roads]);
  
  const handleAction = useCallback((action: NavAction) => {
    const state = stateRef.current;
    if (!state.active && action !== 'toggle-nav') return;
    
    switch (action) {
      case 'toggle-nav':
        if (state.active) {
          state.active = false;
          onExit?.();
        }
        break;
        
      case 'exit-nav':
        state.active = false;
        onExit?.();
        break;
        
      case 'speed-up':
        if (state.verticalMode === 'grounded') {
          state.speed = Math.min(5, state.speed + 1) as SpeedLevel;
        }
        break;
        
      case 'speed-down':
        if (state.verticalMode === 'grounded') {
          state.speed = Math.max(0, state.speed - 1) as SpeedLevel;
        }
        break;
        
      case 'rotate-left':
        state.podRotation = ((state.podRotation - 1 + 6) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
        state.movementDirection = (state.podRotation / 6) * Math.PI * 2;
        break;
        
      case 'rotate-right':
        state.podRotation = ((state.podRotation + 1) % 6) as 0 | 1 | 2 | 3 | 4 | 5;
        state.movementDirection = (state.podRotation / 6) * Math.PI * 2;
        break;
        
      case 'pan-left':
        state.cameraPan = (state.cameraPan - 15 + 360) % 360;
        break;
        
      case 'pan-right':
        state.cameraPan = (state.cameraPan + 15) % 360;
        break;
        
      case 'pan-left-fine':
        state.cameraPan = (state.cameraPan - 1 + 360) % 360;
        break;
        
      case 'pan-right-fine':
        state.cameraPan = (state.cameraPan + 1) % 360;
        break;
        
      case 'tilt-up':
        state.cameraTilt = Math.min(180, state.cameraTilt + 5);
        break;
        
      case 'tilt-down':
        state.cameraTilt = Math.max(0, state.cameraTilt - 5);
        break;
        
      case 'ascend':
        if (state.inTowerId !== null) {
          const boundary = boundaries.find(b => b.towerId === state.inTowerId);
          if (boundary) {
            const maxFloor = Math.floor(boundary.maxFloorY / floorSpacing);
            if (state.currentFloor >= maxFloor) {
              // At top - trigger ejection
              state.verticalMode = 'ejected';
              state.ejectionProgress = 0;
              state.ejectionStart = [...state.position];
              
              // Find a random connected road to land on
              const connectedRoads = getConnectedRoads(state.inTowerId, roads);
              if (connectedRoads.length > 0) {
                const targetRoad = connectedRoads[Math.floor(Math.random() * connectedRoads.length)];
                // Land at midpoint of road
                const landPos = getRoadPosition(targetRoad, 0.5);
                state.ejectionEnd = landPos;
              } else {
                // Fallback: land at tower base
                state.ejectionEnd = [state.position[0], 0, state.position[2] + 10];
              }
            } else if (state.verticalMode !== 'ascending') {
              // Start ascending to next floor
              state.verticalMode = 'ascending';
            }
          }
        }
        break;
        
      case 'descend':
        if (state.inTowerId !== null && state.verticalMode !== 'ejected') {
          if (state.currentFloor <= 0) {
            // At ground - exit tower to road
            state.inTowerId = null;
            state.verticalMode = 'grounded';
            const closestRoad = findClosestRoad(state.position, roads);
            state.currentRoad = closestRoad?.road || null;
            state.roadProgress = closestRoad?.progress || 0;
          } else if (state.verticalMode !== 'descending') {
            state.verticalMode = 'descending';
          }
        }
        break;
        
      case 'camera-slot-1':
        state.cameraSlot = 0;
        break;
      case 'camera-slot-2':
        state.cameraSlot = 1;
        break;
      case 'camera-slot-3':
        state.cameraSlot = 2;
        break;
      case 'camera-slot-4':
        state.cameraSlot = 3;
        break;
      case 'camera-slot-5':
        state.cameraSlot = 4;
        break;
      case 'camera-slot-6':
        state.cameraSlot = 5;
        break;
      case 'camera-slot-7':
        state.cameraSlot = 6;
        break;
        
      case 'height-up':
        state.cameraHeight = Math.min(4, state.cameraHeight + 1) as CameraHeight;
        break;
        
      case 'height-down':
        state.cameraHeight = Math.max(0, state.cameraHeight - 1) as CameraHeight;
        break;
        
      case 'reset-camera':
        state.cameraSlot = 0;
        state.cameraHeight = 2;
        state.cameraPan = 0;
        state.cameraTilt = 90;
        break;
    }
    
    onStateChange?.(state);
  }, [boundaries, roads, floorSpacing, onStateChange, onExit]);
  
  // Animation frame update
  useFrame((_, delta) => {
    const state = stateRef.current;
    if (!state.active) return;
    
    const speed = SPEED_VALUES[state.speed];
    
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
      
      if (movingForward) {
        state.roadProgress = Math.min(1, state.roadProgress + progressDelta);
      } else {
        state.roadProgress = Math.max(0, state.roadProgress - progressDelta);
      }
      
      // Update position
      const newPos = getRoadPosition(state.currentRoad, state.roadProgress);
      state.position = [newPos[0], podHeight / 2, newPos[2]];
      
      // Check if entering a tower boundary
      const tower = findTowerAtPosition(state.position, boundaries);
      if (tower) {
        state.inTowerId = tower.towerId;
        state.currentFloor = 0;
        state.speed = 0;
        state.currentRoad = null;
      }
      
      // Check if reached end of road - transition to connected road
      if (state.currentRoad && (state.roadProgress >= 1 || state.roadProgress <= 0)) {
        const atTowerId = state.roadProgress >= 1 
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
          
          state.currentRoad = bestRoad;
          // Start from the tower end
          if (bestRoad.fromTowerId === atTowerId) {
            state.roadProgress = 0;
          } else {
            state.roadProgress = 1;
          }
        }
      }
    } else if (state.verticalMode === 'ascending') {
      // Ascending to next floor
      const targetY = (state.currentFloor + 1) * floorSpacing + podHeight / 2;
      const currentY = state.position[1];
      const ascentSpeed = 3; // units per second
      
      const newY = Math.min(targetY, currentY + ascentSpeed * delta);
      state.position = [state.position[0], newY, state.position[2]];
      
      if (newY >= targetY) {
        state.currentFloor += 1;
        state.verticalMode = 'grounded';
        state.position = [state.position[0], targetY, state.position[2]];
      }
    } else if (state.verticalMode === 'descending') {
      // Descending to previous floor
      const targetY = (state.currentFloor - 1) * floorSpacing + podHeight / 2;
      const currentY = state.position[1];
      const descentSpeed = 3;
      
      const newY = Math.max(targetY, currentY - descentSpeed * delta);
      state.position = [state.position[0], newY, state.position[2]];
      
      if (newY <= targetY) {
        state.currentFloor -= 1;
        state.verticalMode = 'grounded';
        state.position = [state.position[0], targetY, state.position[2]];
      }
    } else if (state.verticalMode === 'ejected' && state.ejectionStart && state.ejectionEnd) {
      // Parabolic ejection arc
      const ejectionDuration = 3; // seconds
      state.ejectionProgress = Math.min(1, state.ejectionProgress + delta / ejectionDuration);
      
      const arcPos = parabolicLerp(
        state.ejectionStart,
        state.ejectionEnd,
        state.ejectionProgress,
        state.ejectionPeakHeight
      );
      state.position = arcPos;
      
      if (state.ejectionProgress >= 1) {
        // Landed
        state.verticalMode = 'grounded';
        state.inTowerId = null;
        state.currentFloor = 0;
        state.position = [state.ejectionEnd[0], podHeight / 2, state.ejectionEnd[2]];
        state.ejectionStart = null;
        state.ejectionEnd = null;
        
        // Find the road we landed on
        const closestRoad = findClosestRoad(state.position, roads);
        state.currentRoad = closestRoad?.road || null;
        state.roadProgress = closestRoad?.progress || 0;
      }
    }
    
    // Update camera position and rotation
    const camPos = calculateCameraPosition(
      state.position,
      state.podRotation,
      state.cameraSlot,
      state.cameraHeight,
      podRadius,
      podHeight
    );
    
    const camRot = calculateCameraRotation(
      state.podRotation,
      state.cameraPan,
      state.cameraTilt
    );
    
    camera.position.set(...camPos);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(camRot[0], camRot[1], camRot[2]);
    camera.updateProjectionMatrix();
  });
  
  const reset = useCallback(() => {
    const closestRoad = findClosestRoad(startPosition, roads);
    stateRef.current = {
      ...DEFAULT_NAVIGATION_STATE,
      active: true,
      position: startPosition,
      currentRoad: closestRoad?.road || null,
      roadProgress: closestRoad?.progress || 0,
    };
  }, [startPosition, roads]);
  
  // Calculate current camera values for external use
  const cameraPosition = calculateCameraPosition(
    stateRef.current.position,
    stateRef.current.podRotation,
    stateRef.current.cameraSlot,
    stateRef.current.cameraHeight,
    podRadius,
    podHeight
  );
  
  const cameraRotation = calculateCameraRotation(
    stateRef.current.podRotation,
    stateRef.current.cameraPan,
    stateRef.current.cameraTilt
  );
  
  return {
    state: stateRef.current,
    handleAction,
    cameraPosition,
    cameraRotation,
    reset,
  };
}

/** Hook to handle keyboard input for pod navigation */
export function usePodNavigationKeyboard(
  active: boolean,
  handleAction: (action: NavAction) => void,
) {
  useEffect(() => {
    if (!active) return;
    
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      const action = NAV_KEY_BINDINGS[event.key];
      if (action) {
        event.preventDefault();
        handleAction(action);
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, handleAction]);
}
