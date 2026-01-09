import React, { useMemo, useState } from 'react';
import { ringAPI, Assembly, Floor, Ring } from '../api';
import { PodDetailsPanel } from './PodDetailsPanel';

interface ContextPanelProps {
  selectedPodId: number | null;
  selectedFloorId: number | null;
  assemblies: Assembly[];
  floors: Floor[];
  selectedPodInfo: {
    assemblyName?: string;
    floorName?: string;
    podName?: string;
  };
  onLayoutChanged: () => void;
  onPodSelect: (id: number) => void;
  onAssignmentsChanged: () => void;
  onPodUpdated: () => void;
  onClearPodSelection: () => void;
  onProcessPod: (podId: number) => void;
}

interface FloorContextContentProps {
  floors: Floor[];
  selectedFloorId: number | null;
  selectedPodId: number | null;
  onLayoutChanged: () => void;
  onPodSelect: (id: number) => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  selectedPodId,
  selectedFloorId,
  assemblies,
  floors,
  selectedPodInfo,
  onLayoutChanged,
  onPodSelect,
  onAssignmentsChanged,
  onPodUpdated,
  onClearPodSelection,
  onProcessPod,
}) => {
  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.floorId === selectedFloorId) || null,
    [floors, selectedFloorId],
  );

  const activeAssemblyName = useMemo(() => {
    if (!selectedFloor) return undefined;
    return assemblies.find((assembly) => assembly.assemblyId === selectedFloor.assemblyId)?.name;
  }, [assemblies, selectedFloor]);

  const headerLine = selectedPodId
    ? `Assembly: ${selectedPodInfo.assemblyName || '—'} — Floor: ${selectedPodInfo.floorName || '—'} — Pod: ${selectedPodInfo.podName || 'Untitled Pod'}`
    : selectedFloor
      ? `Assembly: ${activeAssemblyName || '—'} — Floor: ${selectedFloor.name}`
      : 'Assemblies & Floors';

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface)',
        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              color: 'var(--text)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              paddingBottom: '4px',
              borderBottom: '1px solid var(--border)',
              marginBottom: 0,
            }}
          >
            {headerLine}
          </div>
        </div>
        {selectedPodId && (
          <button
            onClick={onClearPodSelection}
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text)',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to floor panel
          </button>
        )}
      </div>

      <div style={{ 
        padding: '10px', 
        backgroundColor: 'var(--bg-surface)',
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
      }}>
        {selectedPodId ? (
          <PodDetailsPanel
            podId={selectedPodId}
            podName={selectedPodInfo.podName}
            onAssignmentsChanged={onAssignmentsChanged}
            onPodUpdated={onPodUpdated}
            onProcessPod={onProcessPod}
          />
        ) : (
          <FloorContextContent
            floors={floors}
            selectedFloorId={selectedFloorId}
            selectedPodId={selectedPodId}
            onLayoutChanged={onLayoutChanged}
            onPodSelect={onPodSelect}
          />
        )}
      </div>
    </section>
  );
};

const FloorContextContent: React.FC<FloorContextContentProps> = ({
  floors,
  selectedFloorId,
  selectedPodId,
  onLayoutChanged,
  onPodSelect,
}) => {
  const [newRingName, setNewRingName] = useState('');
  const [newRingRadius, setNewRingRadius] = useState(0);
  const [newRingSlots, setNewRingSlots] = useState(1);
  const [editingRingId, setEditingRingId] = useState<number | null>(null);
  const [editRingName, setEditRingName] = useState('');
  const [editRingRadius, setEditRingRadius] = useState(0);

  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.floorId === selectedFloorId) || null,
    [floors, selectedFloorId],
  );

  const handleCreateRing = async () => {
    if (!selectedFloorId || !newRingName.trim()) {
      alert('Please select a floor and enter a ring name');
      return;
    }
    try {
      await ringAPI.create(selectedFloorId, {
        name: newRingName.trim(),
        radiusIndex: newRingRadius,
        slots: newRingSlots,
      });
      setNewRingName('');
      setNewRingRadius(0);
      setNewRingSlots(1);
      onLayoutChanged();
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
    if (!editingRingId || !editRingName.trim()) {
      alert('Please enter a ring name');
      return;
    }
    try {
      await ringAPI.update(editingRingId, {
        name: editRingName.trim(),
        radiusIndex: editRingRadius,
      });
      setEditingRingId(null);
      setEditRingName('');
      setEditRingRadius(0);
      onLayoutChanged();
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
      onLayoutChanged();
    } catch (error: any) {
      console.error('Failed to delete ring:', error);
      alert(`Error deleting ring: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div
      style={{
        padding: 0,
      }}
    >
      {selectedFloor ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedFloor.rings && selectedFloor.rings.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'grid',
                  gap: '6px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                }}
              >
                {selectedFloor.rings.map((ring) => (
                  <div
                    key={ring.ringId}
                    style={{
                      padding: '6px 8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-elevated)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {editingRingId === ring.ringId ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editRingName}
                          onChange={(event) => setEditRingName(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleSaveRingEdit()}
                          style={{ flex: '1 1 120px', padding: '4px 6px', fontSize: '11px' }}
                          placeholder="Name"
                          autoFocus
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                          Radius:
                          <input
                            type="number"
                            min="0"
                            value={editRingRadius}
                            onChange={(event) => setEditRingRadius(parseInt(event.target.value, 10) || 0)}
                            style={{ width: '50px', padding: '4px 5px', fontSize: '11px' }}
                          />
                        </label>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'Consolas', monospace" }}>
                          {ring.slots} slots
                        </span>
                        <button onClick={handleSaveRingEdit} style={{ padding: '3px 6px', fontSize: '11px' }}>
                          ✓
                        </button>
                        <button onClick={() => setEditingRingId(null)} style={{ padding: '3px 6px', fontSize: '11px' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: 'var(--text)', fontSize: '11px' }}>{ring.name}</strong>
                            <span
                              style={{
                                marginLeft: '6px',
                                color: 'var(--text-muted)',
                                fontSize: '10px',
                                fontFamily: "'Consolas', monospace",
                              }}
                            >
                              r{ring.radiusIndex} · {ring.slots} slots · {ring.pods?.length || 0} pods
                            </span>
                          </div>
                          <button onClick={() => handleEditRing(ring)} style={{ padding: '2px 5px', fontSize: '10px' }}>
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteRing(ring.ringId, ring.name)}
                            style={{ padding: '2px 5px', color: 'var(--danger)', fontSize: '10px' }}
                          >
                            🗑️
                          </button>
                        </div>
                        {ring.pods && ring.pods.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
                                    title={`Pod ${pod.slotIndex === -1 ? 'Center' : pod.slotIndex}`}
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      padding: 0,
                                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                      borderRadius: '4px',
                                      backgroundColor: isSelected
                                        ? '#ffb900'
                                        : hasAssignment
                                          ? '#107c10'
                                          : '#0078d4',
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No rings yet. Add one below.</div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '300px auto auto auto',
              gap: '8px',
              alignItems: 'center',
              padding: '8px',
              border: '1px dashed var(--border)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <input
              type="text"
              placeholder="Ring name"
              value={newRingName}
              onChange={(event) => setNewRingName(event.target.value)}
              style={{ width: '100%', padding: '5px 7px', fontSize: '11px', boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>
              Radius:
              <input
                type="number"
                min="0"
                value={newRingRadius}
                onChange={(event) => setNewRingRadius(parseInt(event.target.value, 10) || 0)}
                style={{ width: '50px', padding: '4px 5px', fontSize: '11px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>
              Slots:
              <input
                type="number"
                min="1"
                value={newRingSlots}
                onChange={(event) => setNewRingSlots(parseInt(event.target.value, 10) || 1)}
                style={{ width: '50px', padding: '4px 5px', fontSize: '11px' }}
              />
            </label>
            <button
              onClick={handleCreateRing}
              style={{
                padding: '5px 10px',
                backgroundColor: 'var(--accent)',
                border: '1px solid var(--accent)',
                color: 'white',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '11px',
                justifySelf: 'end',
              }}
            >
              + Ring
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Select a floor from the left sidebar to manage its rings.
        </div>
      )}
    </div>
  );
};
