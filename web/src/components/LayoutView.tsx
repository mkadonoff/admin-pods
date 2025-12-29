import React, { useMemo, useState } from 'react';
import { ringAPI, Assembly, Floor, Ring } from '../api';
import { Canvas } from '@react-three/fiber';
import { Text, OrbitControls, Bounds } from '@react-three/drei';

const POD_RADIUS = 0.75;
const POD_HEIGHT = 1.4;
const FLOOR_SPACING = 2.5;
const ASSEMBLY_GAP = 3;

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
}: {
  position: [number, number, number];
  isSelected: boolean;
  hasAssignment: boolean;
  onClick: () => void;
}) {
  return (
    <mesh position={position} onClick={onClick}>
      <cylinderGeometry args={[POD_RADIUS * 0.8, POD_RADIUS * 0.8, POD_HEIGHT, 6]} />
      <meshStandardMaterial
        color={isSelected ? '#ffb900' : hasAssignment ? '#107c10' : '#0078d4'}
      />
    </mesh>
  );
}

// 3D Ring component - renders pods in a circle
function RingMesh({
  ring,
  floorY,
  assemblyX,
  selectedPodId,
  onPodSelect,
}: {
  ring: Ring;
  floorY: number;
  assemblyX: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
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
}: {
  floor: Floor;
  floorIndex: number;
  assemblyX: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
}) {
  const floorY = floorIndex * FLOOR_SPACING;
  const rings = floor.rings || [];

  return (
    <group>
      {/* Floor platform */}
      <mesh position={[assemblyX, floorY - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[getAssemblyMaxRadius([floor]) * 2.5, 32]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* Floor edge ring for visibility */}
      <mesh position={[assemblyX, floorY - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[getAssemblyMaxRadius([floor]) * 2.5 - 0.05, getAssemblyMaxRadius([floor]) * 2.5, 64]} />
        <meshStandardMaterial color="#0078d4" transparent opacity={0.8} />
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
}: {
  assembly: Assembly;
  floors: Floor[];
  xOffset: number;
  selectedPodId: number | null;
  onPodSelect: (podId: number) => void;
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
}

export const LayoutView: React.FC<LayoutViewProps> = ({
  assemblies,
  floors,
  activeAssemblyId: _activeAssemblyId,
  selectedFloorId,
  selectedPodId,
  onPodSelect,
  assignmentsVersion: _assignmentsVersion,
}) => {
  // Ring creation state (for selected floor)
  const [newRingName, setNewRingName] = useState('');
  const [newRingRadius, setNewRingRadius] = useState(0);
  const [newRingSlots, setNewRingSlots] = useState(1);

  // Ring editing state
  const [editingRingId, setEditingRingId] = useState<number | null>(null);
  const [editRingName, setEditRingName] = useState('');
  const [editRingRadius, setEditRingRadius] = useState(0);

  const selectedFloor = floors.find((f) => f.floorId === selectedFloorId);

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
  const cameraPosition = useMemo<[number, number, number]>(() => {
    if (assemblies.length === 0) return [0, 5, 15];
    const totalWidth = Object.values(assemblyOffsets).reduce((max, x) => Math.max(max, x), 0);
    const centerX = totalWidth / 2;
    const maxFloors = Math.max(...assemblies.map((a) => floors.filter((f) => f.assemblyId === a.assemblyId).length), 1);
    return [centerX, maxFloors * FLOOR_SPACING, totalWidth + 10];
  }, [assemblies, floors, assemblyOffsets]);

  const handleCreateRing = async () => {
    if (!selectedFloorId || !newRingName) {
      alert('Please select a floor and enter a ring name');
      return;
    }
    try {
      await ringAPI.create(selectedFloorId, {
        name: newRingName,
        radiusIndex: newRingRadius,
        slots: newRingSlots,
      });
      setNewRingName('');
      setNewRingRadius(0);
      setNewRingSlots(1);
      // Trigger refresh via parent
      window.location.reload(); // Simple refresh for now
    } catch (error: any) {
      console.error('Failed to create ring:', error);
      alert(`Error creating ring: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditRing = (ring: Ring) => {
    setEditingRingId(ring.ringId);
    setEditRingName(ring.name);
    setEditRingRadius(ring.radiusIndex);
  };

  const handleSaveRingEdit = async () => {
    if (!editingRingId || !editRingName.trim()) return;
    try {
      await ringAPI.update(editingRingId, { 
        name: editRingName.trim(),
        radiusIndex: editRingRadius,
      });
      setEditingRingId(null);
      setEditRingName('');
      setEditRingRadius(0);
      window.location.reload();
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
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to delete ring:', error);
      alert(`Error deleting ring: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* 3D View */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, backgroundColor: '#e8eef3' }}>
        <Canvas camera={{ position: cameraPosition, fov: 50 }}>
          <color attach="background" args={['#e8eef3']} />
          <OrbitControls makeDefault enablePan enableZoom enableRotate />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <gridHelper args={[100, 50, '#c0c8d0', '#d8e0e8']} />

          <Bounds fit clip observe margin={1.5}>
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

      {/* Ring Creation Panel (only when floor is selected) */}
      {selectedFloor && (
        <div
          style={{
            padding: '16px 20px',
            borderTop: '2px solid var(--accent)',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
            maxHeight: '40vh',
            overflowY: 'auto',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <strong style={{ color: 'var(--text)' }}>Floor: {selectedFloor.name}</strong>

          {/* Existing Rings */}
          {selectedFloor.rings && selectedFloor.rings.length > 0 ? (
            <div style={{ marginTop: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rings:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedFloor.rings.map((ring) => (
                  <div
                    key={ring.ringId}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {editingRingId === ring.ringId ? (
                      <>
                        <input
                          type="text"
                          value={editRingName}
                          onChange={(e) => setEditRingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRingEdit()}
                          style={{ width: '80px', padding: '4px' }}
                          placeholder="Name"
                          autoFocus
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                          r:
                          <input
                            type="number"
                            min="0"
                            value={editRingRadius}
                            onChange={(e) => setEditRingRadius(parseInt(e.target.value) || 0)}
                            style={{ width: '45px', padding: '4px' }}
                          />
                        </label>
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontFamily: "'Consolas', monospace" }}>
                          {ring.slots} slots (fixed)
                        </span>
                        <button onClick={handleSaveRingEdit} style={{ padding: '2px 6px' }}>✓</button>
                        <button onClick={() => setEditingRingId(null)} style={{ padding: '2px 6px' }}>✕</button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: 'var(--text)' }}>{ring.name}</strong>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontFamily: "'Consolas', monospace", fontSize: '11px' }}>
                            r{ring.radiusIndex} · {ring.slots} slots · {ring.pods?.length || 0} pods
                          </span>
                          {/* Pod buttons */}
                          {ring.pods && ring.pods.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {ring.pods
                                .slice()
                                .sort((a, b) => a.slotIndex - b.slotIndex)
                                .map((pod) => {
                                  const hasAssignment = (pod.assignments?.length ?? 0) > 0;
                                  const isSelected = selectedPodId === pod.podId;
                                  return (
                                    <button
                                      key={pod.podId}
                                      onClick={() => onPodSelect(pod.podId)}
                                      title={`Pod ${pod.slotIndex === -1 ? 'C' : pod.slotIndex}${hasAssignment ? ' (assigned)' : ''}`}
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        padding: 0,
                                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                        borderRadius: '4px',
                                        backgroundColor: isSelected ? '#ffb900' : hasAssignment ? '#107c10' : '#0078d4',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: "'Consolas', monospace",
                                      }}
                                    >
                                      {pod.slotIndex === -1 ? 'C' : pod.slotIndex}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleEditRing(ring)}
                          style={{ padding: '2px 6px', marginLeft: '4px', fontSize: '11px' }}
                          title="Edit ring"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteRing(ring.ringId, ring.name)}
                          style={{ padding: '2px 6px', color: 'var(--danger)', fontSize: '11px' }}
                          title="Delete ring"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
              No rings yet. Add one below.
            </div>
          )}

          {/* Add Ring Form */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <input
              type="text"
              placeholder="Ring name"
              value={newRingName}
              onChange={(e) => setNewRingName(e.target.value)}
              style={{ 
                padding: '6px 10px', 
                width: '120px',
              }}
            />
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Radius:
              <input
                type="number"
                min="0"
                value={newRingRadius}
                onChange={(e) => setNewRingRadius(parseInt(e.target.value) || 0)}
                style={{ 
                  width: '50px', 
                  marginLeft: '4px', 
                  padding: '6px',
                }}
              />
            </label>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Slots:
              <input
                type="number"
                min="1"
                value={newRingSlots}
                onChange={(e) => setNewRingSlots(parseInt(e.target.value) || 1)}
                style={{ 
                  width: '50px', 
                  marginLeft: '4px', 
                  padding: '6px',
                }}
              />
            </label>
            <button 
              onClick={handleCreateRing} 
              style={{ 
                padding: '6px 12px',
                backgroundColor: 'var(--accent)',
                border: '1px solid var(--accent)',
                color: 'white',
                fontWeight: 600,
              }}
            >
              + Ring
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
