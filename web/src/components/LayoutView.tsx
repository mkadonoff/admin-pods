import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tower, Floor } from '../api';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  ViewPreset,
  VIEW_PRESET_KEYS,
  lerpVec3,
} from '../navigation';
import {
  POD_HEIGHT,
  FLOOR_SPACING,
  FLOOR_RADIUS_SCALE,
  TOWER_GAP,
  INITIAL_CAMERA_POSITION,
  Vec3,
  TowerPosition,
  generateHexSpiralCoords,
  getTowerMaxRadius,
  PodMesh,
  TowerMesh,
  HexagonalGrid,
} from './layout';

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
  focusRequest?: { nonce: number } | null;
  /** Whether the user is in lobby mode (no presence pod set) */
  lobbyMode?: boolean;
}

export const LayoutView: React.FC<LayoutViewProps> = ({
  towers,
  floors,
  activeTowerId,
  selectedFloorId: _selectedFloorId,
  selectedPodId,
  onPodSelect,
  assignmentsVersion: _assignmentsVersion,
  onLayoutChanged: _onLayoutChanged,
  presencePodId,
  processRequest,
  onRequestProcessSelected,
  focusRequest,
  lobbyMode = false,
}) => {
  const [cameraPosition, setCameraPosition] = useState<Vec3>(INITIAL_CAMERA_POSITION);
  const [cameraTarget, setCameraTarget] = useState<Vec3>([0, 0, 0]);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<ViewPreset>('birds-eye');

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    autoRotate: false,
    showFloorGrid: false,
  });

  // Workflow animation state (for "process pod" feature)
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

  // First-person look state (yaw and pitch in radians)
  const [firstPersonLook, setFirstPersonLook] = useState<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera animation state for smooth focus transitions
  const [cameraAnimation, setCameraAnimation] = useState<{
    from: Vec3;
    to: Vec3;
    targetFrom: Vec3;
    targetTo: Vec3;
    startTime: number;
    duration: number;
  } | null>(null);

  const orbitControlsRef = useRef<OrbitControlsImpl>(null);

  // Place towers in a hexagonal (honeycomb) grid
  const TowerPositions = useMemo(() => {
    const positions: Record<number, TowerPosition> = {};
    if (towers.length === 0) return positions;

    const sortedTowers = [...towers].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    let maxTowerRadiusWorld = 1;
    for (const Tower of sortedTowers) {
      const TowerFloors = floors.filter((f) => f.towerId === Tower.towerId);
      maxTowerRadiusWorld = Math.max(maxTowerRadiusWorld, getTowerMaxRadius(TowerFloors) * FLOOR_RADIUS_SCALE);
    }

    const minCenterDist = 2 * maxTowerRadiusWorld + TOWER_GAP;
    const hexSize = minCenterDist / Math.sqrt(3);
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

  // Scene bounds for view presets
  const sceneBounds = useMemo(() => {
    if (towers.length === 0) {
      return { centerX: 0, centerZ: 0, extent: 20, maxFloors: 1 };
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let maxFloors = 1;

    for (const tower of towers) {
      const pos = TowerPositions[tower.towerId] ?? { x: 0, z: 0 };
      const towerFloors = floors.filter((f) => f.towerId === tower.towerId);
      maxFloors = Math.max(maxFloors, towerFloors.length || 1);
      const radiusWorld = getTowerMaxRadius(towerFloors) * FLOOR_RADIUS_SCALE;
      minX = Math.min(minX, pos.x - radiusWorld);
      maxX = Math.max(maxX, pos.x + radiusWorld);
      minZ = Math.min(minZ, pos.z - radiusWorld);
      maxZ = Math.max(maxZ, pos.z + radiusWorld);
    }

    return {
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      extent: Math.max(maxX - minX, maxZ - minZ),
      maxFloors,
    };
  }, [towers, floors, TowerPositions]);

  // Get presence pod position
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

  // Is the user currently in first-person mode?
  const isFirstPerson = currentPreset === 'first-person' && presencePodInfo;

  // Compute camera position for each view preset
  const getPresetCamera = useCallback((preset: ViewPreset): { position: Vec3; target: Vec3 } => {
    const { centerX, centerZ, extent, maxFloors } = sceneBounds;
    
    switch (preset) {
      case 'first-person': {
        if (!presencePodInfo) {
          // Fallback to birds-eye if no presence
          return getPresetCamera('birds-eye');
        }
        // Inside pod at eye level (head height of humanoid)
        const eyeHeight = POD_HEIGHT * 0.7;
        const pos: Vec3 = [
          presencePodInfo.position[0],
          presencePodInfo.position[1] - POD_HEIGHT / 2 + eyeHeight,
          presencePodInfo.position[2],
        ];
        // Look outward from the pod (away from tower center toward scene edge)
        const towerPos = TowerPositions[presencePodInfo.towerId] ?? { x: 0, z: 0 };
        const dirX = pos[0] - towerPos.x;
        const dirZ = pos[2] - towerPos.z;
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        // Normalize and extend to look outward
        const lookDist = 10;
        const target: Vec3 = [
          pos[0] + (dirX / dist) * lookDist,
          pos[1],
          pos[2] + (dirZ / dist) * lookDist,
        ];
        return { position: pos, target };
      }
      
      case 'birds-eye': {
        // High above, looking down at all towers
        const height = maxFloors * FLOOR_SPACING + extent * 0.8 + 20;
        const pos: Vec3 = [centerX, height, centerZ + extent * 0.3];
        const target: Vec3 = [centerX, 0, centerZ];
        return { position: pos, target };
      }
      
      case 'tower-focus': {
        // Focus on active tower (or presence tower, or first tower)
        let targetTowerId = activeTowerId;
        if (!targetTowerId && presencePodInfo) {
          targetTowerId = presencePodInfo.towerId;
        }
        if (!targetTowerId && towers.length > 0) {
          targetTowerId = towers[0].towerId;
        }
        
        const towerPos = targetTowerId ? TowerPositions[targetTowerId] : { x: centerX, z: centerZ };
        const towerFloors = floors.filter(f => f.towerId === targetTowerId);
        const towerHeight = (towerFloors.length || 1) * FLOOR_SPACING;
        
        const pos: Vec3 = [
          (towerPos?.x ?? centerX) + 15,
          towerHeight + 10,
          (towerPos?.z ?? centerZ) + 15,
        ];
        const target: Vec3 = [towerPos?.x ?? centerX, towerHeight / 2, towerPos?.z ?? centerZ];
        return { position: pos, target };
      }
      
      case 'floor-slice': {
        // Side view showing selected floor or ground floor
        const floorY = presencePodInfo ? presencePodInfo.floorIndex * FLOOR_SPACING : 0;
        const pos: Vec3 = [centerX + extent + 10, floorY + POD_HEIGHT / 2, centerZ];
        const target: Vec3 = [centerX, floorY + POD_HEIGHT / 2, centerZ];
        return { position: pos, target };
      }
      
      default:
        return { position: INITIAL_CAMERA_POSITION, target: [0, 0, 0] };
    }
  }, [sceneBounds, presencePodInfo, activeTowerId, towers, floors, TowerPositions]);

  // Animate camera to a new position
  const animateCameraTo = useCallback((position: Vec3, target: Vec3, duration = 800) => {
    setCameraAnimation({
      from: cameraPosition,
      to: position,
      targetFrom: cameraTarget,
      targetTo: target,
      startTime: Date.now(),
      duration,
    });
  }, [cameraPosition, cameraTarget]);

  // Switch to a view preset
  const switchToPreset = useCallback((preset: ViewPreset) => {
    const { position, target } = getPresetCamera(preset);
    setCurrentPreset(preset);
    animateCameraTo(position, target);
  }, [getPresetCamera, animateCameraTo]);

  // Sync OrbitControls target when cameraTarget changes (fixes initial askew view)
  useEffect(() => {
    if (orbitControlsRef.current && !isFirstPerson) {
      orbitControlsRef.current.target.set(...cameraTarget);
      orbitControlsRef.current.update();
    }
  }, [cameraTarget, isFirstPerson]);

  // Initialize camera on load
  useEffect(() => {
    if (towers.length === 0) {
      setCameraPosition(INITIAL_CAMERA_POSITION);
      setCameraTarget([0, 0, 0]);
      setCameraInitialized(false);
      return;
    }
    if (!cameraInitialized) {
      // Start in first-person if we have a presence pod, otherwise birds-eye (lobby)
      const initialPreset: ViewPreset = lobbyMode ? 'birds-eye' : 'first-person';
      const { position, target } = getPresetCamera(initialPreset);
      setCameraPosition(position);
      setCameraTarget(target);
      setCurrentPreset(initialPreset);
      setCameraInitialized(true);
    }
  }, [towers.length, cameraInitialized, getPresetCamera, lobbyMode]);

  // Track if we've ever had a presence pod (to detect first assignment)
  const hadPresencePodRef = useRef(false);
  
  // When presence pod becomes available FOR THE FIRST TIME, switch to first-person
  useEffect(() => {
    if (presencePodInfo && !hadPresencePodRef.current) {
      hadPresencePodRef.current = true;
      // Only auto-switch if we're currently in lobby/birds-eye mode
      if (currentPreset === 'birds-eye' && !lobbyMode) {
        switchToPreset('first-person');
      }
    }
  }, [presencePodInfo, lobbyMode]);

  // Find pod scene info helper
  const findPodSceneInfo = useCallback(
    (podId: number): { origin: Vec3; TowerX: number; TowerZ: number } | null => {
      for (const floor of floors) {
        for (const ring of floor.rings || []) {
          for (const pod of ring.pods || []) {
            if (pod.podId !== podId) continue;
            const TowerPos = TowerPositions[floor.towerId] ?? { x: 0, z: 0 };
            const floorsInTower = floors.filter((f) => f.towerId === floor.towerId);
            const sortedFloors = [...floorsInTower].sort((a, b) => a.orderIndex - b.orderIndex);
            const floorIndex = sortedFloors.findIndex((f) => f.floorId === floor.floorId);
            const floorY = (floorIndex >= 0 ? floorIndex : 0) * FLOOR_SPACING;

            const radius = ring.radiusIndex * 2;
            let x: number, z: number;
            if (pod.slotIndex === -1) {
              x = TowerPos.x;
              z = TowerPos.z;
            } else {
              const angle = (2 * Math.PI * pod.slotIndex) / ring.slots;
              x = TowerPos.x + radius * Math.cos(angle);
              z = TowerPos.z + radius * Math.sin(angle);
            }

            return { origin: [x, floorY + POD_HEIGHT / 2, z], TowerX: TowerPos.x, TowerZ: TowerPos.z };
          }
        }
      }
      return null;
    },
    [floors, TowerPositions],
  );

  // Focus on a specific pod
  const focusOnPod = useCallback((podId: number) => {
    const info = findPodSceneInfo(podId);
    if (!info) return;
    
    const distance = 10;
    const offset: Vec3 = [distance * 0.6, distance * 0.4, distance * 0.8];
    const newPos: Vec3 = [
      info.origin[0] + offset[0],
      info.origin[1] + offset[1],
      info.origin[2] + offset[2],
    ];
    animateCameraTo(newPos, info.origin);
  }, [findPodSceneInfo, animateCameraTo]);

  // Handle focus request
  useEffect(() => {
    if (!focusRequest || !selectedPodId) return;
    focusOnPod(selectedPodId);
  }, [focusRequest?.nonce]);

  // Layout extents for workflow animation
  const layoutExtents = useMemo(() => {
    const { maxFloors } = sceneBounds;
    let maxRadiusIndexPlusOne = 1;
    for (const tower of towers) {
      const towerFloors = floors.filter((f) => f.towerId === tower.towerId);
      maxRadiusIndexPlusOne = Math.max(maxRadiusIndexPlusOne, getTowerMaxRadius(towerFloors));
    }
    const maxRingRadius = (maxRadiusIndexPlusOne - 1) * 2;
    const margin = 6;
    return { zOutside: maxRingRadius + margin, maxFloors };
  }, [towers, floors, sceneBounds]);

  // Workflow animation (process pod feature)
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
        origin, centerOnLevel, topAboveHighest, outsideAtTop,
        outsideBelow, centerBelow, centerBackAtStartLevel, origin,
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

  // Process request handler
  useEffect(() => {
    if (!processRequest) return;
    startWorkflow(processRequest.podId);
  }, [processRequest?.nonce]);

  // Keyboard shortcuts for view presets and actions
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Arrow keys for first-person look (when in first-person mode)
      if (isFirstPerson) {
        const ARROW_ROTATE_SPEED = 0.05;
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            setFirstPersonLook(prev => ({ ...prev, yaw: prev.yaw - ARROW_ROTATE_SPEED }));
            return;
          case 'ArrowRight':
            event.preventDefault();
            setFirstPersonLook(prev => ({ ...prev, yaw: prev.yaw + ARROW_ROTATE_SPEED }));
            return;
          case 'ArrowUp':
            event.preventDefault();
            setFirstPersonLook(prev => ({ 
              ...prev, 
              pitch: Math.min(Math.PI / 3, prev.pitch + ARROW_ROTATE_SPEED) 
            }));
            return;
          case 'ArrowDown':
            event.preventDefault();
            setFirstPersonLook(prev => ({ 
              ...prev, 
              pitch: Math.max(-Math.PI / 3, prev.pitch - ARROW_ROTATE_SPEED) 
            }));
            return;
        }
      }

      // View preset keys (1-4)
      const preset = VIEW_PRESET_KEYS[event.key];
      if (preset) {
        event.preventDefault();
        switchToPreset(preset);
        return;
      }

      // Focus on selected pod (F key)
      if ((event.key === 'f' || event.key === 'F') && selectedPodId) {
        event.preventDefault();
        focusOnPod(selectedPodId);
        return;
      }

      // Process pod (P key)
      if (event.key === 'p' || event.key === 'P') {
        onRequestProcessSelected?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchToPreset, selectedPodId, focusOnPod, onRequestProcessSelected, isFirstPerson]);

  // Reset first-person look when switching to first-person preset
  useEffect(() => {
    if (currentPreset === 'first-person' && presencePodInfo) {
      // Calculate initial yaw based on pod position relative to tower
      const towerPos = TowerPositions[presencePodInfo.towerId] ?? { x: 0, z: 0 };
      const dirX = presencePodInfo.position[0] - towerPos.x;
      const dirZ = presencePodInfo.position[2] - towerPos.z;
      const initialYaw = Math.atan2(dirX, dirZ);
      setFirstPersonLook({ yaw: initialYaw, pitch: 0 });
    }
  }, [currentPreset, presencePodInfo, TowerPositions]);

  const workflowDimPodId = workflow?.active ? workflow.podId : null;

  // First-person mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFirstPerson) return;
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [isFirstPerson]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFirstPerson || !isDraggingRef.current) return;
    
    const sensitivity = 0.003;
    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    
    setFirstPersonLook(prev => ({
      yaw: prev.yaw + deltaX * sensitivity,
      pitch: Math.max(-Math.PI / 3, Math.min(Math.PI / 3, prev.pitch + deltaY * sensitivity)),
    }));
  }, [isFirstPerson]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Scene controller component for camera animation
  const SceneControllers: React.FC = () => {
    const { camera } = useThree();

    useFrame((_, delta) => {
      // First-person mode: lock camera position and apply look rotation
      if (isFirstPerson && presencePodInfo && !cameraAnimation) {
        const eyeHeight = POD_HEIGHT * 0.7;
        const fixedPos: Vec3 = [
          presencePodInfo.position[0],
          presencePodInfo.position[1] - POD_HEIGHT / 2 + eyeHeight,
          presencePodInfo.position[2],
        ];
        camera.position.set(...fixedPos);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = firstPersonLook.yaw;
        camera.rotation.x = firstPersonLook.pitch;
        camera.updateProjectionMatrix();
        return; // Skip other camera updates in first-person
      }

      // Camera animation for smooth transitions
      if (cameraAnimation) {
        const elapsed = Date.now() - cameraAnimation.startTime;
        const t = Math.min(1, elapsed / cameraAnimation.duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        
        const newPos = lerpVec3(cameraAnimation.from, cameraAnimation.to, eased) as Vec3;
        const newTarget = lerpVec3(cameraAnimation.targetFrom, cameraAnimation.targetTo, eased) as Vec3;
        
        camera.position.set(...newPos);
        if (orbitControlsRef.current) {
          orbitControlsRef.current.target.set(...newTarget);
          orbitControlsRef.current.update();
        }
        
        if (t >= 1) {
          setCameraAnimation(null);
          setCameraPosition(newPos);
          setCameraTarget(newTarget);
        }
      }

      // Workflow animation tick
      setWorkflow((current) => {
        if (!current?.active) return current;
        const segment = current.segments[current.segmentIndex];
        if (!segment) return { ...current, active: false };

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
      {/* Lobby mode banner */}
      {lobbyMode && (
        <div style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          backgroundColor: 'rgba(0, 99, 177, 0.95)',
          color: 'white',
          padding: '16px 32px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Welcome to the Digital Twin</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Select yourself in the Entity Library (right panel), then assign yourself to a pod to enter the workspace.
          </div>
        </div>
      )}

      {/* 3D View */}
      <div 
        style={{ 
          flex: 1, 
          position: 'relative', 
          minHeight: 0, 
          height: '100%', 
          backgroundColor: '#e6f2ff',
          cursor: isFirstPerson ? 'grab' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* View preset buttons - top right */}
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 100,
          display: 'flex',
          gap: 4,
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '4px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {(['first-person', 'birds-eye', 'tower-focus', 'floor-slice'] as ViewPreset[]).map((preset, idx) => {
            const labels = ['1st Person', 'Overview', 'Tower', 'Slice'];
            const icons = ['👁️', '🗺️', '🏢', '📐'];
            const isActive = currentPreset === preset;
            const isDisabled = preset === 'first-person' && lobbyMode;
            return (
              <button
                key={preset}
                onClick={() => switchToPreset(preset)}
                disabled={isDisabled}
                title={`${preset.replace('-', ' ')} (${idx + 1})`}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  minWidth: 52,
                }}
              >
                <span style={{ fontSize: 14 }}>{icons[idx]}</span>
                <span>{labels[idx]}</span>
              </button>
            );
          })}
        </div>

        {/* First-person mode indicator */}
        {isFirstPerson && (
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: 'rgba(0, 99, 177, 0.85)',
            color: 'white',
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
          }}>
            👁️ First-Person View — Drag or use arrow keys to look around
          </div>
        )}
        <Canvas camera={{ position: cameraPosition, fov: 50 }} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={['#e6f2ff']} />
          <OrbitControls
            ref={orbitControlsRef}
            makeDefault
            enabled={!isFirstPerson}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={200}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
            enableDamping
            dampingFactor={0.15}
            rotateSpeed={0.35}
            panSpeed={0.5}
            zoomSpeed={0.7}
            autoRotate={settings.autoRotate && !isFirstPerson}
            autoRotateSpeed={0.5}
          />
          <ambientLight intensity={0.7} />
          <hemisphereLight intensity={0.4} color="#b3d9ff" groundColor="#e6f2ff" />
          <directionalLight 
            position={[10, 20, 10]} 
            intensity={0.8} 
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
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
                    onPodDoubleClick={(podId) => focusOnPod(podId)}
                  />
                );
              })}
            </group>
          </Bounds>
        </Canvas>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ 
          position: 'absolute',
          top: 10,
          right: 10,
          width: 300, 
          padding: 16, 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 100,
        }}>
          <h3 style={{ fontSize: 14, margin: '0 0 12px 0', color: 'var(--text)' }}>Settings</h3>
          <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              checked={settings.autoRotate} 
              onChange={(e) => setSettings(s => ({ ...s, autoRotate: e.target.checked }))}
            />
            Auto Rotate (Birds-eye)
          </label>
          <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input 
              type="checkbox" 
              checked={settings.showFloorGrid} 
              onChange={(e) => setSettings(s => ({ ...s, showFloorGrid: e.target.checked }))}
            />
            Show Floor Grid
          </label>
          <button
            onClick={() => setShowSettings(false)}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              fontSize: 12,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Settings gear button */}
      <button
        onClick={() => setShowSettings(v => !v)}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.9)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          display: showSettings ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          zIndex: 100,
        }}
        title="Settings"
      >
        ⚙️
      </button>
    </div>
  );
};
