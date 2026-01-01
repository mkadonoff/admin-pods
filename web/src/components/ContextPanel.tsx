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
}) => {
  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.floorId === selectedFloorId) || null,
    [floors, selectedFloorId],
  );

  const activeAssemblyName = useMemo(() => {
    if (!selectedFloor) return undefined;
    return assemblies.find((assembly) => assembly.assemblyId === selectedFloor.assemblyId)?.name;
  }, [assemblies, selectedFloor]);

  const headerAssemblyName = selectedPodId
    ? selectedPodInfo.assemblyName || '—'
    : selectedFloor
      ? activeAssemblyName || '—'
      : undefined;

  const headerFloorName = selectedPodId
    ? selectedPodInfo.floorName || '—'
    : selectedFloor
      ? selectedFloor.name
      : undefined;

  const headerPodName = selectedPodId ? selectedPodInfo.podName || 'Untitled Pod' : undefined;

  return (
    <section
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface)',
        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            color: 'var(--text)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          {headerAssemblyName && (
            <span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assembly:</span> {headerAssemblyName}
            </span>
          )}
          {headerFloorName && (
            <span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Floor:</span> {headerFloorName}
            </span>
          )}
          {headerPodName && (
            <span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Pod:</span> {headerPodName}
            </span>
          )}
          {!headerAssemblyName && !headerFloorName && !headerPodName && <span>Assemblies & Floors</span>}
        </div>
        {selectedPodId && (
          <button
            onClick={onClearPodSelection}
            title="Back to floor panel"
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↩
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '16px',
          backgroundColor: 'var(--bg-surface)',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          scrollPaddingTop: '16px',
        }}
      >
        {selectedPodId ? (
          <PodDetailsPanel
            podId={selectedPodId}
            podName={selectedPodInfo.podName}
            onAssignmentsChanged={onAssignmentsChanged}
            onPodUpdated={onPodUpdated}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedFloor.rings && selectedFloor.rings.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                }}
              >
                {selectedFloor.rings.map((ring) => (
                  <div
                    key={ring.ringId}
                    style={{
                      scrollSnapAlign: 'start',
                      scrollSnapStop: 'always',
                      padding: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-elevated)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {editingRingId === ring.ringId ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editRingName}
                          onChange={(event) => setEditRingName(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleSaveRingEdit()}
                          style={{ flex: '0 0 200px', width: '200px', padding: '6px 8px' }}
                          placeholder="Name"
                          autoFocus
                        />
                        <label style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          Radius:
                          <input
                            type="number"
                            min="0"
                            value={editRingRadius}
                            onChange={(event) => setEditRingRadius(parseInt(event.target.value, 10) || 0)}
                            style={{ width: '60px', padding: '6px' }}
                          />
                        </label>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Consolas', monospace" }}>
                          {ring.slots} slots
                        </span>
                        <button onClick={handleSaveRingEdit} style={{ padding: '4px 8px' }}>
                          ✓
                        </button>
                        <button onClick={() => setEditingRingId(null)} style={{ padding: '4px 8px' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{ring.name}</strong>
                            <span
                              style={{
                                marginLeft: '8px',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                fontFamily: "'Consolas', monospace",
                              }}
                            >
                              r{ring.radiusIndex} · {ring.slots} slots · {ring.pods?.length || 0} pods
                            </span>
                          </div>
                          <button onClick={() => handleEditRing(ring)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteRing(ring.ringId, ring.name)}
                            style={{ padding: '4px 8px', color: 'var(--danger)', fontSize: '11px' }}
                          >
                            🗑️
                          </button>
                        </div>
                        {ring.pods && ring.pods.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                                      width: '28px',
                                      height: '28px',
                                      padding: 0,
                                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                      borderRadius: '6px',
                                      backgroundColor: isSelected
                                        ? '#ffb900'
                                        : hasAssignment
                                          ? '#107c10'
                                          : '#0078d4',
                                      color: 'white',
                                      fontSize: '11px',
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
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              padding: '12px',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <input
              type="text"
              placeholder="Ring name"
              value={newRingName}
              onChange={(event) => setNewRingName(event.target.value)}
              style={{ flex: '1 1 260px', minWidth: '180px', maxWidth: '320px', padding: '8px 10px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              Radius:
              <input
                type="number"
                min="0"
                value={newRingRadius}
                onChange={(event) => setNewRingRadius(parseInt(event.target.value, 10) || 0)}
                style={{ width: '60px', padding: '6px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              Slots:
              <input
                type="number"
                min="1"
                value={newRingSlots}
                onChange={(event) => setNewRingSlots(parseInt(event.target.value, 10) || 1)}
                style={{ width: '60px', padding: '6px' }}
              />
            </label>
            <button
              onClick={handleCreateRing}
              style={{
                padding: '8px 14px',
                backgroundColor: 'var(--accent)',
                border: '1px solid var(--accent)',
                color: 'white',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              + Ring
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
          Select a floor from the left sidebar to manage its rings.
        </div>
      )}
    </div>
  );
};
