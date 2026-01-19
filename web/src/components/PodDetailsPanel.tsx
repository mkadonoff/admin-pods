import React, { useState, useEffect } from 'react';
import { assignmentAPI, entityAPI, podAPI } from '../api';

interface Assignment {
  assignmentId: number;
  podId: number;
  entityId: number;
  roleTag?: string | null;
  entity?: { displayName: string; entityType?: string };
  pod?: { name?: string };
}

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
}

interface PodDetailsPanelProps {
  digitalTwinId: number | null;
  podId: number | null;
  onAssignmentsChanged?: () => void;
  podName?: string;
  onPodUpdated?: () => void;
  onProcessPod?: (podId: number) => void;
  entityRefreshKey?: number;
}

export const PodDetailsPanel: React.FC<PodDetailsPanelProps> = ({
  digitalTwinId,
  podId,
  onAssignmentsChanged,
  podName,
  onPodUpdated,
  onProcessPod,
  entityRefreshKey,
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
  }, [podId, digitalTwinId, entityRefreshKey]);

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
    if (!digitalTwinId) {
      setEntities([]);
      return;
    }
    try {
      const response = await entityAPI.list(digitalTwinId);
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

    // Check if entity is already assigned to a different pod
    const existingAssignment = allAssignments.find((a) => a.entityId === selectedEntityId && a.podId !== podId);
    
    if (existingAssignment) {
      const entityName = entities.find((e) => e.entityId === selectedEntityId)?.displayName || 'Entity';
      const existingPodName = existingAssignment.pod?.name || `Pod ${existingAssignment.podId}`;
      
      const confirmed = window.confirm(
        `${entityName} is currently assigned to "${existingPodName}".\n\nDo you want to reassign it to this pod?`
      );
      
      if (!confirmed) {
        return;
      }

      // Remove the old assignment first
      try {
        await assignmentAPI.delete(existingAssignment.assignmentId);
      } catch (error: any) {
        console.error('Failed to remove old assignment:', error);
        alert(`Error removing old assignment: ${error.response?.data?.error || error.message}`);
        return;
      }
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

  // Filter out entities already assigned to THIS pod (prevent duplicate assignments to same pod)
  const currentPodAssignedEntityIds = new Set(assignments.map((assignment) => assignment.entityId));
  const availableEntities = entities.filter((entity) => !currentPodAssignedEntityIds.has(entity.entityId));
  const isCompanyPod = assignments.some((assignment) => (assignment.entity?.entityType || '').toLowerCase() === 'company');

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
      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
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
            padding: '6px 8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: '4px',
            fontSize: '11px',
          }}
        />
        <button
          onClick={handleSavePodName}
          disabled={savingPodName}
          style={{
            padding: '6px 10px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: savingPodName ? 0.7 : 1,
            fontSize: '11px',
            minWidth: '70px',
          }}
        >
          {savingPodName ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
        <button
          onClick={() => {
            if (!podId) return;
            if (!isCompanyPod) {
              alert('This workflow can only be run for a pod assigned to a Company entity.');
              return;
            }
            onProcessPod?.(podId);
          }}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Process
        </button>
      </div>

      <section style={{ marginBottom: '10px' }}>
        <h4
          style={{
            color: 'var(--accent)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '5px',
          }}
        >
          Assign Entity
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 1fr) minmax(120px, 0.7fr)',
            gap: '5px',
            marginBottom: '6px',
          }}
        >
          <select
            value={selectedEntityId}
            onChange={(event) => setSelectedEntityId(event.target.value ? parseInt(event.target.value, 10) : '')}
            style={{
              width: '100%',
              padding: '5px 7px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: '4px',
              fontSize: '11px',
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
              padding: '5px 7px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          />
        </div>
        <button
          onClick={handleAssignEntity}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '11px',
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
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
          }}
        >
          Current Assignments
        </h4>
        {assignments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No assignments yet</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '6px',
            }}
          >
            {assignments.map((assignment) => (
              <li
                key={assignment.assignmentId}
                style={{
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {assignment.entity?.displayName || 'Unknown'}
                  </div>
                  {assignment.roleTag && (
                    <div
                      style={{
                        fontSize: '10px',
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
                    padding: '3px 7px',
                    backgroundColor: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
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
