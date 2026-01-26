import React, { useState } from 'react';
import { syncAPI, EntitySyncType } from '../api';

interface SyncPanelProps {
  digitalTwinId: number | null;
  onSyncComplete?: () => void;
}

const ENTITY_TYPES: { key: EntitySyncType; label: string; icon: string }[] = [
  { key: 'customers', label: 'Customers', icon: '🏢' },
  { key: 'contacts', label: 'Contacts', icon: '👤' },
  { key: 'users', label: 'Users', icon: '👥' },
  { key: 'equipment', label: 'Equipment', icon: '🖨️' },
];

export const SyncPanel: React.FC<SyncPanelProps> = ({ digitalTwinId, onSyncComplete }) => {
  const [syncing, setSyncing] = useState<EntitySyncType | 'full' | null>(null);
  const [lastResult, setLastResult] = useState<{
    type: string;
    created: number;
    updated: number;
    deleted: number;
    errors: number;
    syncedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSingleSync = async (entityType: EntitySyncType) => {
    if (syncing) return;
    
    setSyncing(entityType);
    setError(null);
    setLastResult(null);

    try {
      const response = await syncAPI.single(entityType, digitalTwinId ?? undefined);
      setLastResult({
        type: response.data.entityType,
        created: response.data.created,
        updated: response.data.updated,
        deleted: response.data.deleted,
        errors: response.data.errors.length,
        syncedAt: response.data.syncedAt,
      });
      onSyncComplete?.();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleFullSync = async () => {
    if (syncing) return;
    
    setSyncing('full');
    setError(null);
    setLastResult(null);

    try {
      const response = await syncAPI.full(digitalTwinId ?? undefined);
      const data = response.data as any;
      setLastResult({
        type: 'All',
        created: data.totalCreated,
        updated: data.totalUpdated,
        deleted: data.totalDeleted,
        errors: data.results?.filter((r: any) => r.errors.length > 0).length || 0,
        syncedAt: data.syncedAt,
      });
      onSyncComplete?.();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'var(--bg-elevated)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
    }}>
      <h3 style={{
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span>🔄</span> e-automate Sync
      </h3>

      {/* Individual sync buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '10px',
      }}>
        {ENTITY_TYPES.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => handleSingleSync(key)}
            disabled={syncing !== null}
            style={{
              padding: '8px 10px',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: syncing === key ? 'var(--accent)' : 'var(--bg-primary)',
              color: syncing === key ? 'white' : 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: syncing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: syncing && syncing !== key ? 0.5 : 1,
            }}
          >
            <span>{icon}</span>
            {syncing === key ? 'Syncing...' : label}
          </button>
        ))}
      </div>

      {/* Full sync button */}
      <button
        onClick={handleFullSync}
        disabled={syncing !== null}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: syncing === 'full' ? 'var(--accent)' : 'var(--bg-primary)',
          color: syncing === 'full' ? 'white' : 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          cursor: syncing ? 'wait' : 'pointer',
          opacity: syncing && syncing !== 'full' ? 0.5 : 1,
        }}
      >
        {syncing === 'full' ? '⏳ Syncing All...' : '🔄 Sync All Entities'}
      </button>

      {/* Result display */}
      {lastResult && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: 'rgba(16, 124, 16, 0.1)',
          border: '1px solid rgba(16, 124, 16, 0.3)',
          borderRadius: '4px',
          fontSize: '11px',
          color: 'var(--text)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            ✅ {lastResult.type} Sync Complete
          </div>
          <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
            <span>+{lastResult.created} created</span>
            <span>↻{lastResult.updated} updated</span>
            <span>-{lastResult.deleted} deleted</span>
            {lastResult.errors > 0 && (
              <span style={{ color: '#d83b01' }}>⚠️{lastResult.errors} errors</span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: 'rgba(164, 38, 44, 0.1)',
          border: '1px solid rgba(164, 38, 44, 0.3)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#a4262c',
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
};
