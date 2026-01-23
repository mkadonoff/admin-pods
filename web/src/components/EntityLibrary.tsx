import React, { useState, useEffect, useRef } from 'react';
import { entityAPI } from '../api';

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
  content?: string | null;
}

interface EntityLibraryProps {
  digitalTwinId: number | null;
  onEntitiesChanged?: () => void;
  variant?: 'sidebar' | 'panel';
}

export const EntityLibrary: React.FC<EntityLibraryProps> = ({ digitalTwinId, onEntitiesChanged, variant = 'sidebar' }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newEntityType, setNewEntityType] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [documentDrafts, setDocumentDrafts] = useState<Record<number, string>>({});

  const isPanelVariant = variant === 'panel';
  const containerStyle = {
    padding: '10px',
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

  // Debounce filter and search inputs
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedFilter(filter);
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filter, search]);

  useEffect(() => {
    if (digitalTwinId) {
      loadEntities();
    } else {
      setEntities([]);
    }
  }, [digitalTwinId, debouncedFilter, debouncedSearch]);

  const loadEntities = async () => {
    if (!digitalTwinId) {
      return [];
    }
    try {
      const response = await entityAPI.list(digitalTwinId, debouncedFilter || undefined, debouncedSearch || undefined);
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
    if (!digitalTwinId) {
      alert('Please select a digital twin first');
      return;
    }
    if (!newEntityType || !newEntityName) {
      alert('Please enter entity type and name');
      return;
    }
    try {
      await entityAPI.create({
        entityType: newEntityType,
        displayName: newEntityName,
        digitalTwinId,
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
        fontSize: '12px', 
        fontWeight: 600, 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        marginBottom: '10px',
        paddingBottom: '6px',
        borderBottom: '1px solid var(--border)',
      }}>Entity Library</h2>

      {/* Create Entity */}
      <div style={{ 
        marginBottom: '10px', 
        padding: '8px', 
        border: '1px solid var(--border)', 
        borderRadius: '4px',
        backgroundColor: 'var(--bg-elevated)',
      }}>
        <h3 style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 600, marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add Entity</h3>
        <input
          type="text"
          placeholder="Entity type (e.g., Person, Machine)"
          value={newEntityType}
          onChange={(e) => setNewEntityType(e.target.value)}
          style={{ 
            width: '100%', 
            marginBottom: '5px', 
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '5px 6px',
            borderRadius: '3px',
            fontSize: '11px',
          }}
        />
        <input
          type="text"
          placeholder="Entity name"
          value={newEntityName}
          onChange={(e) => setNewEntityName(e.target.value)}
          style={{ 
            width: '100%', 
            marginBottom: '6px', 
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '5px 6px',
            borderRadius: '3px',
            fontSize: '11px',
          }}
        />
        <button 
          onClick={handleCreateEntity} 
          style={{ 
            width: '100%',
            backgroundColor: 'var(--accent)',
            border: '1px solid var(--accent)',
            color: 'white',
            fontWeight: 600,
            padding: '5px 6px',
            fontSize: '11px',
          }}
        >Add Entity</button>
      </div>

      {/* Filter & Search */}
      <input
        type="text"
        placeholder="Filter by type"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ 
          width: '100%', 
          marginBottom: '5px', 
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '5px 6px',
          borderRadius: '3px',
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
          marginBottom: '8px', 
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '5px 6px',
          borderRadius: '3px',
          fontSize: '11px',
        }}
      />

      {/* Entities List */}
      <h3 style={{ 
        color: 'var(--text-muted)', 
        fontSize: '10px', 
        fontWeight: 600, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '6px',
      }}>Entities <span style={{ color: 'var(--accent)', fontFamily: "'Consolas', monospace" }}>({entities.length})</span></h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {entities.map((e) => (
          <li
            key={e.entityId}
            style={{
              marginBottom: '5px',
              padding: '6px 8px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '3px',
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
                    marginBottom: '5px', 
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                  }}
                />
                <button
                  onClick={() => handleSaveEdit(e.entityId)}
                  style={{
                    marginRight: '4px',
                    padding: '3px 8px',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: '3px 8px',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: 'var(--text)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1', minWidth: 0 }}>{e.displayName}</strong>
                  <small style={{ color: 'var(--text-muted)', fontSize: '10px', whiteSpace: 'nowrap' }}>({e.entityType})</small>
                  <button
                    onClick={() => handleEditEntity(e.entityId, e.displayName)}
                    style={{
                      padding: '1px 5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flexShrink: 0,
                    }}
                    title="Edit entity"
                    aria-label={`Edit ${e.displayName}`}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteEntity(e.entityId, e.displayName)}
                    style={{
                      padding: '1px 5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--danger)',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      flexShrink: 0,
                    }}
                    title="Delete entity"
                    aria-label={`Delete ${e.displayName}`}
                  >
                    🗑️
                  </button>
                </div>
                {e.entityType === 'Document' && (
                  <div style={{ marginTop: '6px' }}>
                    <textarea
                      value={getDocumentDraftValue(e)}
                      onChange={(event) => handleDocumentDraftChange(e.entityId, event.target.value)}
                      onBlur={() => handleDocumentContentSave(e)}
                      onKeyDown={(event) => handleDocumentKeyDown(event, e)}
                      placeholder="Document content"
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        marginTop: '5px',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '5px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
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
