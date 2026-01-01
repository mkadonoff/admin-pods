import React, { useState, useEffect } from 'react';
import { entityAPI } from '../api';

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
  content?: string | null;
}

interface EntityLibraryProps {
  onEntitiesChanged?: () => void;
  variant?: 'sidebar' | 'panel';
}

export const EntityLibrary: React.FC<EntityLibraryProps> = ({ onEntitiesChanged, variant = 'sidebar' }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [newEntityType, setNewEntityType] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [documentDrafts, setDocumentDrafts] = useState<Record<number, string>>({});

  const isPanelVariant = variant === 'panel';
  const containerStyle = {
    padding: '16px',
    width: isPanelVariant ? '100%' : '280px',
    overflowY: 'auto' as const,
    backgroundColor: 'var(--bg-surface)',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    borderLeft: isPanelVariant ? 'none' : '1px solid var(--border)',
    border: isPanelVariant ? '1px solid var(--border)' : undefined,
    borderRadius: isPanelVariant ? '10px' : undefined,
    boxShadow: isPanelVariant ? '0 2px 6px rgba(0,0,0,0.06)' : undefined,
    height: '100%',
  };

  useEffect(() => {
    loadEntities();
  }, [filter, search]);

  const loadEntities = async () => {
    try {
      const response = await entityAPI.list(filter || undefined, search || undefined);
      setEntities(response.data);
      const nextDrafts: Record<number, string> = {};
      response.data
        .filter((entity) => entity.entityType === 'Document')
        .forEach((entity) => {
          nextDrafts[entity.entityId] = entity.content ?? '';
        });
      setDocumentDrafts(nextDrafts);
      return response.data;
    } catch (error) {
      console.error('Failed to load entities', error);
      return [];
    }
  };

  const handleCreateEntity = async () => {
    if (!newEntityType || !newEntityName) {
      alert('Please enter entity type and name');
      return;
    }
    try {
      await entityAPI.create({
        entityType: newEntityType,
        displayName: newEntityName,
      });
      setNewEntityType('');
      setNewEntityName('');
      await loadEntities();
      onEntitiesChanged?.();
    } catch (error: any) {
      console.error('Failed to create entity:', error);
      alert(`Error creating entity: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditEntity = (entityId: number, currentName: string) => {
    setEditingId(entityId);
    setEditName(currentName);
  };

  const handleSaveEdit = async (entityId: number) => {
    if (!editName) {
      alert('Please enter an entity name');
      return;
    }
    try {
      await entityAPI.update(entityId, { displayName: editName });
      setEditingId(null);
      await loadEntities();
      onEntitiesChanged?.();
    } catch (error: any) {
      console.error('Failed to update entity:', error);
      alert(`Error updating entity: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteEntity = async (entityId: number, entityName: string) => {
    if (!window.confirm(`Delete entity "${entityName}"?`)) {
      return;
    }
    try {
      await entityAPI.delete(entityId);
      await loadEntities();
      onEntitiesChanged?.();
    } catch (error: any) {
      console.error('Failed to delete entity:', error);
      alert(`Error deleting entity: ${error.response?.data?.error || error.message}`);
    }
  };

  const getDocumentDraftValue = (entity: Entity) => documentDrafts[entity.entityId] ?? entity.content ?? '';

  const handleDocumentDraftChange = (entityId: number, value: string) => {
    setDocumentDrafts((prev) => ({ ...prev, [entityId]: value }));
  };

  const handleDocumentContentSave = async (entity: Entity) => {
    const draftValue = getDocumentDraftValue(entity);
    if ((entity.content ?? '') === draftValue) {
      return;
    }
    try {
      await entityAPI.update(entity.entityId, { content: draftValue });
      onEntitiesChanged?.();
      await loadEntities();
    } catch (error: any) {
      console.error('Failed to update document content:', error);
      alert(`Error updating document: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDocumentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, entity: Entity) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      handleDocumentContentSave(entity);
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ 
        color: 'var(--text)', 
        fontSize: '13px', 
        fontWeight: 600, 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        marginBottom: '16px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)',
      }}>Entity Library</h2>

      {/* Create Entity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Entity type (e.g., Person, Machine)"
          value={newEntityType}
          onChange={(e) => setNewEntityType(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateEntity()}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
          }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Entity name"
            value={newEntityName}
            onChange={(e) => setNewEntityName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateEntity()}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '12px',
            }}
          />
          <button
            onClick={handleCreateEntity}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--accent)',
              border: '1px solid var(--accent)',
              color: 'white',
              fontWeight: 600,
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            + Entity
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <input
        type="text"
        placeholder="Filter by type"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ 
          width: '100%', 
          marginBottom: '8px', 
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
        }}
      />
      <input
        type="text"
        placeholder="Search name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ 
          width: '100%', 
          marginBottom: '12px', 
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
        }}
      />

      {/* Entities List */}
      <h3 style={{ 
        color: 'var(--text-muted)', 
        fontSize: '11px', 
        fontWeight: 600, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px',
      }}>Entities <span style={{ color: 'var(--accent)', fontFamily: "'Consolas', monospace" }}>({entities.length})</span></h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {entities.map((e) => (
          <li
            key={e.entityId}
            style={{
              marginBottom: '8px',
              padding: '10px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '4px',
              border: '1px solid var(--border)',
            }}
          >
            {editingId === e.entityId ? (
              <div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    marginBottom: '8px', 
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                  }}
                />
                <button
                  onClick={() => handleSaveEdit(e.entityId)}
                  style={{
                    marginRight: '5px',
                    padding: '4px 10px',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <strong style={{ color: 'var(--text)', fontSize: '12px' }}>{e.displayName}</strong> <br />
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({e.entityType})</small>
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => handleEditEntity(e.entityId, e.displayName)}
                    style={{
                      marginRight: '6px',
                      padding: '2px 6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    title="Edit entity"
                    aria-label={`Edit ${e.displayName}`}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteEntity(e.entityId, e.displayName)}
                    style={{
                      padding: '2px 6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--danger)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    title="Delete entity"
                    aria-label={`Delete ${e.displayName}`}
                  >
                    🗑️
                  </button>
                </div>
                {e.entityType === 'Document' && (
                  <div style={{ marginTop: '10px' }}>
                    <textarea
                      value={getDocumentDraftValue(e)}
                      onChange={(event) => handleDocumentDraftChange(e.entityId, event.target.value)}
                      onBlur={() => handleDocumentContentSave(e)}
                      onKeyDown={(event) => handleDocumentKeyDown(event, e)}
                      placeholder="Document content"
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        marginTop: '8px',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        resize: 'vertical',
                      }}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      Saves on blur or Ctrl+S.
                    </small>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
