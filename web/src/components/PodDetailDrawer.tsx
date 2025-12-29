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
  assemblyName?: string;
  floorName?: string;
  onClose: () => void;
  onAssignmentsChanged?: () => void;
}

export const PodDetailDrawer: React.FC<PodDetailDrawerProps> = ({ podId, assemblyName, floorName, onClose, onAssignmentsChanged }) => {
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
        backgroundColor: 'var(--bg-surface)',
        padding: '20px',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
        overflowY: 'auto',
        zIndex: 1000,
        borderLeft: '1px solid var(--border)',
      }}
    >
      <button 
        onClick={onClose} 
        style={{ 
          float: 'right',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '4px 8px',
        }}
      >
        ✕
      </button>
      <h3 style={{ 
        color: 'var(--text)', 
        fontSize: '14px', 
        fontWeight: 600,
        marginBottom: '16px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border)',
      }}>Pod Details</h3>
      
      {/* Assembly & Floor Info */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '10px', 
        backgroundColor: 'var(--bg-elevated)', 
        borderRadius: '4px',
        border: '1px solid var(--border)',
        fontFamily: "'Consolas', monospace",
        fontSize: '11px',
      }}>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Assembly:</span>{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{assemblyName || '—'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Floor:</span>{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{floorName || '—'}</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="Pod name"
        value={podName}
        onChange={(e) => setPodName(e.target.value)}
        style={{ 
          width: '100%', 
          padding: '8px 10px', 
          marginBottom: '16px', 
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          borderRadius: '4px',
        }}
      />

      <h4 style={{ 
        color: 'var(--accent)', 
        fontSize: '12px', 
        fontWeight: 600, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px',
      }}>Assign Entity</h4>
      <div style={{ marginBottom: '16px' }}>
        <select
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value ? parseInt(e.target.value) : '')}
          style={{ 
            width: '100%', 
            padding: '8px', 
            marginBottom: '8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '4px',
          }}
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
          style={{ 
            width: '100%', 
            padding: '8px', 
            marginBottom: '10px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleAssignEntity}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Assign
        </button>
      </div>

      <h4 style={{ 
        color: 'var(--text-muted)', 
        fontSize: '11px', 
        fontWeight: 600, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px',
      }}>Current Assignments</h4>
      {assignments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No assignments yet</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {assignments.map((a) => (
            <li
              key={a.assignmentId}
              style={{
                padding: '10px',
                marginBottom: '8px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{a.entity?.displayName || 'Unknown'}</div>
                {a.roleTag && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Consolas', monospace" }}>{a.roleTag}</div>}
              </div>
              <button
                onClick={() => handleDeleteAssignment(a.assignmentId)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
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
