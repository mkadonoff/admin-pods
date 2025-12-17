import React, { useState, useEffect } from 'react';
import { podAPI, ringAPI, assignmentAPI } from '../api';

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
}

export const LayoutView: React.FC<LayoutViewProps> = ({ floorId, onPodSelect }) => {
  const [pods, setPods] = useState<Pod[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newRingName, setNewRingName] = useState('');
  const [newRingRadius, setNewRingRadius] = useState(1);
  const [newRingSlots, setNewRingSlots] = useState(6);
  const [editingRingId, setEditingRingId] = useState<number | null>(null);
  const [editRingName, setEditRingName] = useState('');

  useEffect(() => {
    loadPods();
    loadRings();
    loadAssignments();
  }, [floorId]);

  const loadPods = async () => {
    try {
      const response = await podAPI.listByFloor(floorId);
      console.log('Loaded pods:', response.data);
      setPods(response.data);
    } catch (error) {
      console.error('Failed to load pods', error);
    }
  };

  const loadRings = async () => {
    try {
      const response = await ringAPI.listByFloor(floorId);
      console.log('Loaded rings:', response.data);
      setRings(response.data);
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

      {/* Ring Creation */}
      <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
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

      {/* Layout */}
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
    </div>
  );
};
