import React, { useMemo, useState, useEffect, useRef } from 'react';
import { podAPI, ringAPI, assignmentAPI } from '../api';
import { Canvas, useThree } from '@react-three/fiber';

const ROT_STEP = Math.PI / 6; // 30 degrees
const POD_RADIUS = 0.75;
const POD_HEIGHT = 1.4;
const POD_APOTHEM = POD_RADIUS * Math.cos(Math.PI / 6);

function PodMesh({ rotation, scale }: { rotation: [number, number, number]; scale: [number, number, number] }) {
  return (
    <group scale={scale}>
      {/* Pod body (centered), group is positioned by the parent so the bottom sits on y=0 */}
      <mesh rotation={rotation}>
        <cylinderGeometry args={[POD_RADIUS, POD_RADIUS, POD_HEIGHT, 6]} />
        <meshStandardMaterial color="#8aa4d6" />
      </mesh>

      {/* Windows on the +Z side face */}
      <group rotation={rotation} position={[0, 0, POD_APOTHEM + 0.01]}>
        {[-0.35, 0, 0.35].map((y, idx) => (
          <mesh key={idx} position={[0, y, 0]}>
            <planeGeometry args={[POD_RADIUS * 0.72, POD_HEIGHT * 0.18]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function PodScene({ rotation, floorIndex }: { rotation: [number, number, number]; floorIndex?: number }) {
  const { viewport, camera } = useThree();

  // Keep the pod comfortably within view (smaller than the viewport).
  const scale = useMemo<[number, number, number]>(() => {
    const sx = (viewport.width / POD_RADIUS) * 0.35;
    const sy = (viewport.height / POD_HEIGHT) * 0.35;
    const s = Math.min(sx, sy);
    return [s, s, s];
  }, [viewport.width, viewport.height]);

  const podY = (POD_HEIGHT * scale[1]) / 2;

  useEffect(() => {
    // Arrow keys navigate floors/pods in App; here we just tilt camera up/down with floor changes.
    const floorOffset = (floorIndex ?? 0) * (POD_HEIGHT * scale[1]) * 0.6;
    camera.position.set(0, podY + floorOffset, 6);
    camera.lookAt(0, podY, 0);
    camera.updateProjectionMatrix();
  }, [camera, podY, floorIndex, scale]);

  return (
    <>
      {/* Floor (y=0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Pod centered at origin, bottom face on floor */}
      <group position={[0, podY, 0]}>
        <PodMesh rotation={rotation} scale={scale} />
      </group>
    </>
  );
}

interface Pod {
  podId: number;
  name: string;
  podType: string;
  slotIndex: number;
  ringId: number;
}

interface Ring {
  ringId: number;
  name: string;
  radiusIndex: number;
  slots: number;
}

interface Assignment {
  assignmentId: number;
  podId: number;
  entityId: number;
  roleTag?: string;
  entity: { displayName: string };
}

interface LayoutViewProps {
  floorId: number;
  onPodSelect: (podId: number) => void;
  assignmentsVersion?: number;
  floorIndex?: number;
  onLayoutData?: (pods: Pod[], rings: Ring[]) => void;
}

export const LayoutView: React.FC<LayoutViewProps> = ({ floorId, onPodSelect, assignmentsVersion, floorIndex, onLayoutData }) => {
  const [pods, setPods] = useState<Pod[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newRingName, setNewRingName] = useState('');
  const [newRingRadius, setNewRingRadius] = useState(1);
  const [newRingSlots, setNewRingSlots] = useState(6);
  const [editingRingId, setEditingRingId] = useState<number | null>(null);
  const [editRingName, setEditRingName] = useState('');
  const [cubeRotation, setCubeRotation] = useState<[number, number, number]>([0, 0, 0]);
  const podsRef = useRef<Pod[]>([]);
  const ringsRef = useRef<Ring[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = event.key;
      const lower = key.toLowerCase();

      // Controls (3D only):
      // - W/S: rotate X
      // - A/D: rotate Y
      // - Q/E: rotate Z
      if (!['w', 's', 'a', 'd', 'q', 'e'].includes(lower)) return;
      event.preventDefault();

      setCubeRotation(([x, y, z]) => {
        if (lower === 'w') return [x + ROT_STEP, y, z];
        if (lower === 's') return [x - ROT_STEP, y, z];
        if (lower === 'a') return [x, y + ROT_STEP, z];
        if (lower === 'd') return [x, y - ROT_STEP, z];
        if (lower === 'q') return [x, y, z + ROT_STEP];
        if (lower === 'e') return [x, y, z - ROT_STEP];
        return [x, y, z];
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    loadPods();
    loadRings();
    loadAssignments();
  }, [floorId]);

  useEffect(() => {
    loadAssignments();
  }, [assignmentsVersion]);

  const loadPods = async () => {
    try {
      const response = await podAPI.listByFloor(floorId);
      console.log('Loaded pods:', response.data);
      setPods(response.data);
      podsRef.current = response.data;
      onLayoutData?.(podsRef.current, ringsRef.current);
    } catch (error) {
      console.error('Failed to load pods', error);
    }
  };

  const loadRings = async () => {
    try {
      const response = await ringAPI.listByFloor(floorId);
      console.log('Loaded rings:', response.data);
      setRings(response.data);
      ringsRef.current = response.data;
      onLayoutData?.(podsRef.current, ringsRef.current);
    } catch (error) {
      console.error('Failed to load rings', error);
    }
  };

  const loadAssignments = async () => {
    try {
      const response = await assignmentAPI.listAll();
      setAssignments(response.data);
    } catch (error) {
      console.error('Failed to load assignments', error);
    }
  };

  const handleCreateRing = async () => {
    if (!newRingName) {
      alert('Please enter a ring name');
      return;
    }
    try {
      console.log('Creating ring with:', { name: newRingName, radiusIndex: newRingRadius, slots: newRingSlots });
      await ringAPI.create(floorId, {
        name: newRingName,
        radiusIndex: newRingRadius,
        slots: newRingSlots,
      });
      setNewRingName('');
      setNewRingRadius(1);
      setNewRingSlots(6);
      loadRings();
      loadPods();
      loadAssignments();
    } catch (error: any) {
      console.error('Failed to create ring:', error);
      alert(`Error creating ring: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditRing = (ringId: number, currentName: string) => {
    setEditingRingId(ringId);
    setEditRingName(currentName);
  };

  const handleSaveRingEdit = async (ringId: number) => {
    if (!editRingName) {
      alert('Please enter a ring name');
      return;
    }
    try {
      // Update the ring name
      await ringAPI.update(ringId, { name: editRingName });
      
      // Update all pod names in this ring
      const ringPods = ringPodsByRingId[ringId] || [];
      const updatePromises = ringPods.map((pod) => {
        const newPodName = pod.slotIndex === -1 
          ? `${editRingName} Center` 
          : `${editRingName} Pod ${pod.slotIndex}`;
        return podAPI.update(pod.podId, { name: newPodName });
      });
      
      await Promise.all(updatePromises);
      
      setEditingRingId(null);
      loadRings();
      loadPods();
      loadAssignments();
    } catch (error: any) {
      console.error('Failed to update ring:', error);
      alert(`Error updating ring: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteRing = async (ringId: number, ringName: string) => {
    if (!window.confirm(`Delete ring "${ringName}"? This will delete all pods in this ring.`)) {
      return;
    }
    try {
      await ringAPI.delete(ringId);
      loadRings();
      loadPods();
      loadAssignments();
    } catch (error: any) {
      console.error('Failed to delete ring:', error);
      alert(`Error deleting ring: ${error.response?.data?.error || error.message}`);
    }
  };

  const centerPods = pods.filter((p) => p.podType === 'center');
  const ringPodsByRingId: Record<number, Pod[]> = {};
  rings.forEach((ring) => {
    ringPodsByRingId[ring.ringId] = pods.filter((p) => p.ringId === ring.ringId);
  });

  // Helper to get assignment for a pod
  const getAssignmentForPod = (podId: number) => {
    return assignments.find((a) => a.podId === podId);
  };

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
      <h2>Layout View - Floor {floorId}</h2>

      {/* 3D View (center) */}
      <div
        style={{
          marginBottom: '20px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '15px',
          backgroundColor: '#fff',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ marginTop: 0 }}>3D View</h2>
        <div style={{ color: '#999', fontSize: '12px' }}>
          Controls: WASD rotate X/Y, Q/E rotate Z (30° steps). Arrow keys navigate floors/pods.
        </div>
        <div
          style={{
            marginTop: '12px',
            height: '520px',
            border: '1px dashed #ccc',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            overflow: 'hidden',
          }}
        >
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 3, 6]} intensity={1.0} />
            <PodScene rotation={cubeRotation} floorIndex={floorIndex} />
          </Canvas>
        </div>
      </div>

      {/* 2D Layout */}
      <div style={{ textAlign: 'center' }}>
        {/* Center */}
        {centerPods.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h3>Center</h3>
            {centerPods.map((pod) => {
              const assignment = getAssignmentForPod(pod.podId);
              return (
                <button
                  key={pod.podId}
                  onClick={() => onPodSelect(pod.podId)}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    fontSize: '12px',
                    margin: '10px',
                    backgroundColor: assignment ? '#e8f5e9' : '#fff',
                    border: assignment ? '2px solid #4CAF50' : '1px solid #ccc',
                    cursor: 'pointer',
                  }}
                >
                  <div>{pod.name}</div>
                  {assignment && (
                    <div style={{ fontSize: '10px', marginTop: '5px', fontWeight: 'bold', color: '#2e7d32' }}>
                      {assignment.entity.displayName}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Rings */}
        {rings.map((ring) => (
          <div key={ring.ringId} style={{ marginBottom: '40px' }}>
            {editingRingId === ring.ringId ? (
              <>
                <input
                  type="text"
                  value={editRingName}
                  onChange={(e) => setEditRingName(e.target.value)}
                  style={{ marginRight: '5px', marginBottom: '10px' }}
                />
                <button onClick={() => handleSaveRingEdit(ring.ringId)}>Save</button>
                <button onClick={() => setEditingRingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <h3>
                  {ring.name} (Radius {ring.radiusIndex}) - {ring.slots} Slots
                  <button onClick={() => handleEditRing(ring.ringId, ring.name)} style={{ marginLeft: '10px' }}>✏️</button>
                  <button onClick={() => handleDeleteRing(ring.ringId, ring.name)} style={{ marginLeft: '5px', color: '#d32f2f' }}>🗑️</button>
                </h3>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {ringPodsByRingId[ring.ringId]?.map((pod) => {
                const assignment = getAssignmentForPod(pod.podId);
                return (
                  <button
                    key={pod.podId}
                    onClick={() => onPodSelect(pod.podId)}
                    style={{
                      width: '80px',
                      padding: '10px',
                      backgroundColor: assignment ? '#e8f5e9' : '#fff',
                      border: assignment ? '2px solid #4CAF50' : '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <div>{pod.name}</div>
                    {assignment && (
                      <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold', color: '#2e7d32' }}>
                        {assignment.entity.displayName}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {pods.length === 0 && (
          <p style={{ color: '#999' }}>No pods yet. Create a ring to add pods!</p>
        )}
      </div>

      {/* Ring Creation */}
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Create Ring</h3>
        <input
          type="text"
          placeholder="Ring name"
          value={newRingName}
          onChange={(e) => setNewRingName(e.target.value)}
          style={{ marginRight: '10px' }}
        />
        <label style={{ marginRight: '10px' }}>
          Radius:
          <input
            type="number"
            min="0"
            value={newRingRadius}
            onChange={(e) => setNewRingRadius(parseInt(e.target.value))}
            style={{ width: '50px', marginLeft: '5px' }}
          />
        </label>
        <label style={{ marginRight: '10px' }}>
          Slots:
          <input
            type="number"
            min="1"
            value={newRingSlots}
            onChange={(e) => setNewRingSlots(parseInt(e.target.value))}
            style={{ width: '50px', marginLeft: '5px' }}
          />
        </label>
        <button onClick={handleCreateRing}>Create Ring</button>
      </div>
    </div>
  );
};
