import React, { useEffect, useState } from 'react';
import { entityAPI, Entity } from '../api';

interface MyPresenceBarProps {
  digitalTwinId: number | null;
  selectedEntityId: number | null;
  onSelectEntity: (entityId: number | null) => void;
  podName?: string;
  refreshKey?: number;
  /** Whether the user is in lobby mode (no presence pod set) */
  lobbyMode?: boolean;
}

export const MyPresenceBar: React.FC<MyPresenceBarProps> = ({
  digitalTwinId,
  selectedEntityId,
  onSelectEntity,
  podName,
  refreshKey,
  lobbyMode = false,
}) => {
  const [people, setPeople] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadPeople = async () => {
      if (!digitalTwinId) {
        setPeople([]);
        return;
      }
      setLoading(true);
      try {
        const response = await entityAPI.list(digitalTwinId, 'User');
        if (!cancelled) {
          setPeople(response.data.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load people');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadPeople();
    return () => {
      cancelled = true;
    };
  }, [digitalTwinId, refreshKey]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) {
      onSelectEntity(null);
      return;
    }
    const parsed = parseInt(value, 10);
    onSelectEntity(Number.isNaN(parsed) ? null : parsed);
  };

  const presenceText = !selectedEntityId
    ? 'Select your profile to set your presence.'
    : podName
      ? `You are in: ${podName}`
      : 'Assign yourself to a pod to enter the workspace.';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: lobbyMode ? 'rgba(0, 99, 177, 0.1)' : 'var(--bg-surface)',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: '0 0 auto' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          My Presence
        </div>
        <div style={{ fontSize: '13px', color: lobbyMode ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}>
          {presenceText}
        </div>
        {error && (
          <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
            {error}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>I am:</label>
        <select
          value={selectedEntityId ?? ''}
          onChange={handleChange}
          disabled={loading}
          style={{
            padding: '6px 10px',
            minWidth: '220px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text)',
          }}
        >
          <option value="">-- Choose Person --</option>
          {people.map((person) => (
            <option key={person.entityId} value={person.entityId}>
              {person.displayName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
