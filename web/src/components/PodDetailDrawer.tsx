import React, { useState, useEffect } from 'react';
import { assignmentAPI, entityAPI } from '../api';

interface Assignment {
  assignmentId: number;
  entityId: number;
  roleTag?: string | null;
  entity?: { displayName: string };
}

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
}

interface PodDetailDrawerProps {
  podId: number | null;
  onClose: () => void;
  onAssignmentsChanged?: () => void;
}

export const PodDetailDrawer: React.FC<PodDetailDrawerProps> = ({ podId, onClose, onAssignmentsChanged }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [podName, setPodName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<number | ''>('');
  const [roleTag, setRoleTag] = useState('');

  useEffect(() => {
    if (podId) {
      loadAssignments();
      loadAllAssignments();
      loadEntities();
    }
  }, [podId]);

  const loadAssignments = async () => {
    if (!podId) return;
    try {
      const response = await assignmentAPI.listByPod(podId);
      setAssignments(response.data);
    } catch (error) {
      console.error('Failed to load assignments', error);
    }
  };

  const loadAllAssignments = async () => {
    try {
      const response = await assignmentAPI.listAll();
      setAllAssignments(response.data);
    } catch (error) {
      console.error('Failed to load all assignments', error);
    }
  };

  const loadEntities = async () => {
    try {
      const response = await entityAPI.list();
      setEntities(response.data);
    } catch (error) {
      console.error('Failed to load entities', error);
    }
  };

  const handleAssignEntity = async () => {
    if (!podId || !selectedEntityId) {
      alert('Please select an entity');
      return;
    }
    try {
      await assignmentAPI.create(podId, { 
        entityId: selectedEntityId as number, 
        roleTag: roleTag || undefined 
      });
      setSelectedEntityId('');
      setRoleTag('');
      loadAssignments();
      loadAllAssignments();
      onAssignmentsChanged?.();
    } catch (error: any) {
      console.error('Failed to assign entity:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    try {
      await assignmentAPI.delete(assignmentId);
      loadAssignments();
      loadAllAssignments();
      onAssignmentsChanged?.();
    } catch (error) {
      console.error('Failed to delete assignment', error);
    }
  };

  if (!podId) return null;

  const globalAssignedEntityIds = new Set(allAssignments.map(a => a.entityId));
  const availableEntities = entities.filter(e => !globalAssignedEntityIds.has(e.entityId));

  // Don't render if no pod is selected
  if (!podId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '300px',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '20px',
        boxShadow: '-2px 0 5px rgba(0,0,0,0.1)',
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      <button onClick={onClose} style={{ float: 'right' }}>
        ✕
      </button>
      <h3>Pod Details</h3>
      <input
        type="text"
        placeholder="Pod name"
        value={podName}
        onChange={(e) => setPodName(e.target.value)}
        style={{ width: '100%', padding: '5px', marginBottom: '15px', boxSizing: 'border-box' }}
      />

      <h4>Assign Entity</h4>
      <div style={{ marginBottom: '15px' }}>
        <select
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value ? parseInt(e.target.value) : '')}
          style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        >
          <option value="">-- Select Entity --</option>
          {availableEntities.map((e) => (
            <option key={e.entityId} value={e.entityId}>
              {e.displayName} ({e.entityType})
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Role (optional)"
          value={roleTag}
          onChange={(e) => setRoleTag(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />
        <button
          onClick={handleAssignEntity}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Assign
        </button>
      </div>

      <h4>Current Assignments</h4>
      {assignments.length === 0 ? (
        <p style={{ color: '#666' }}>No assignments yet</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {assignments.map((a) => (
            <li
              key={a.assignmentId}
              style={{
                padding: '8px',
                marginBottom: '8px',
                backgroundColor: 'white',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold' }}>{a.entity?.displayName || 'Unknown'}</div>
                {a.roleTag && <div style={{ fontSize: '12px', color: '#666' }}>{a.roleTag}</div>}
              </div>
              <button
                onClick={() => handleDeleteAssignment(a.assignmentId)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
