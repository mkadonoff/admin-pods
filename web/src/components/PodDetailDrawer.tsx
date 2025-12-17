import React, { useState, useEffect } from 'react';
import { podAPI, assignmentAPI } from '../api';

interface Assignment {
  assignmentId: number;
  entityId: number;
  roleTag?: string;
  entity: { displayName: string };
}

interface PodDetailDrawerProps {
  podId: number | null;
  onClose: () => void;
}

export const PodDetailDrawer: React.FC<PodDetailDrawerProps> = ({ podId, onClose }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [podName, setPodName] = useState('');

  useEffect(() => {
    if (podId) {
      loadAssignments();
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

  const handleDeleteAssignment = async (assignmentId: number) => {
    try {
      await assignmentAPI.delete(assignmentId);
      loadAssignments();
    } catch (error) {
      console.error('Failed to delete assignment', error);
    }
  };

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
        style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
      />

      <h4>Assignments</h4>
      <ul>
        {assignments.map((a) => (
          <li key={a.assignmentId}>
            {a.entity.displayName}
            {a.roleTag && ` (${a.roleTag})`}
            <button onClick={() => handleDeleteAssignment(a.assignmentId)} style={{ marginLeft: '10px' }}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
