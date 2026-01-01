import React, { useState, useEffect } from 'react';
import { assignmentAPI, entityAPI, podAPI } from '../api';

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

interface PodDetailsPanelProps {
  podId: number | null;
  onAssignmentsChanged?: () => void;
  podName?: string;
  onPodUpdated?: () => void;
}

export const PodDetailsPanel: React.FC<PodDetailsPanelProps> = ({
  podId,
  onAssignmentsChanged,
  podName,
  onPodUpdated,
}) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [podDisplayName, setPodDisplayName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<number | ''>('');
  const [roleTag, setRoleTag] = useState('');
  const [savingPodName, setSavingPodName] = useState(false);

  useEffect(() => {
    if (podId) {
      loadAssignments();
      loadAllAssignments();
      loadEntities();
    }
  }, [podId]);

  useEffect(() => {
    if (podId) {
      setPodDisplayName(podName ?? '');
    } else {
      setPodDisplayName('');
    }
  }, [podId, podName]);

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
        roleTag: roleTag || undefined,
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

  const handleSavePodName = async () => {
    if (!podId) return;
    const trimmedName = podDisplayName.trim();
    if (!trimmedName) {
      alert('Please enter a pod name');
      return;
    }
    try {
      setSavingPodName(true);
      await podAPI.update(podId, { name: trimmedName });
      onPodUpdated?.();
    } catch (error: any) {
      console.error('Failed to update pod name', error);
      alert(`Error updating pod: ${error.response?.data?.error || error.message}`);
    } finally {
      setSavingPodName(false);
    }
  };

  if (!podId) {
    return null;
  }

  const globalAssignedEntityIds = new Set(allAssignments.map((assignment) => assignment.entityId));
  const availableEntities = entities.filter((entity) => !globalAssignedEntityIds.has(entity.entityId));

  return (
    <div
      style={{
        backgroundColor: 'transparent',
        borderRadius: 0,
        border: 'none',
        padding: 0,
        boxShadow: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input
          type="text"
          placeholder="Pod name"
          value={podDisplayName}
          onChange={(event) => setPodDisplayName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSavePodName();
            }
          }}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '6px',
          }}
        />
        <button
          onClick={handleSavePodName}
          disabled={savingPodName}
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: savingPodName ? 0.7 : 1,
            minWidth: '90px',
          }}
        >
          {savingPodName ? 'Saving…' : 'Save'}
        </button>
      </div>

      <section style={{ marginBottom: '16px' }}>
        <h4
          style={{
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Assign Entity
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 1fr) minmax(140px, 0.7fr)',
            gap: '10px',
            marginBottom: '10px',
          }}
        >
          <select
            value={selectedEntityId}
            onChange={(event) => setSelectedEntityId(event.target.value ? parseInt(event.target.value, 10) : '')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: '6px',
            }}
          >
            <option value="">-- Select Entity --</option>
            {availableEntities.map((entity) => (
              <option key={entity.entityId} value={entity.entityId}>
                {entity.displayName} ({entity.entityType})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Role (optional)"
            value={roleTag}
            onChange={(event) => setRoleTag(event.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: '6px',
            }}
          />
        </div>
        <button
          onClick={handleAssignEntity}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Assign
        </button>
      </section>

      <section>
        <h4
          style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
          }}
        >
          Current Assignments
        </h4>
        {assignments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No assignments yet</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            {assignments.map((assignment) => (
              <li
                key={assignment.assignmentId}
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>
                    {assignment.entity?.displayName || 'Unknown'}
                  </div>
                  {assignment.roleTag && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: "'Consolas', monospace",
                      }}
                    >
                      {assignment.roleTag}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteAssignment(assignment.assignmentId)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
