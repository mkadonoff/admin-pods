import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { entityAPI, EntityTypeCount, getStateColor } from '../api';
import { SyncPanel } from './SyncPanel';

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
  content?: string | null;
}

// Parse entity content JSON to extract state
function getEntityState(entity: Entity): string | null {
  if (!entity.content || entity.entityType !== 'Customer') return null;
  try {
    const parsed = JSON.parse(entity.content);
    return parsed.state || null;
  } catch {
    return null;
  }
}

interface EntityLibraryProps {
  digitalTwinId: number | null;
  onEntitiesChanged?: () => void;
  onEntitySelect?: (entityId: number) => void;
  variant?: 'sidebar' | 'panel';
}

export const EntityLibrary: React.FC<EntityLibraryProps> = ({ digitalTwinId, onEntitiesChanged, onEntitySelect, variant = 'sidebar' }) => {
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string> | 'all'>('all');
  const typeInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination state
  const [pagination, setPagination] = useState<{ total: number; hasMore: boolean }>({ total: 0, hasMore: false });
  const [entityTypes, setEntityTypes] = useState<EntityTypeCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const PAGE_SIZE = 200;

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
      loadEntityTypes();
    } else {
      setEntities([]);
      setEntityTypes([]);
      setPagination({ total: 0, hasMore: false });
    }
  }, [digitalTwinId, debouncedFilter, debouncedSearch]);

  const loadEntityTypes = async () => {
    if (!digitalTwinId) return;
    try {
      const response = await entityAPI.getTypes(digitalTwinId);
      setEntityTypes(response.data);
    } catch (error) {
      console.error('Failed to load entity types', error);
    }
  };

  const loadEntities = async (append = false, offset = 0) => {
    if (!digitalTwinId) {
      return [];
    }
    setIsLoading(true);
    try {
      const response = await entityAPI.list(
        digitalTwinId, 
        debouncedFilter || undefined, 
        debouncedSearch || undefined,
        PAGE_SIZE,
        offset
      );
      const newEntities = response.data.data;
      
      if (append) {
        setEntities(prev => [...prev, ...newEntities]);
      } else {
        setEntities(newEntities);
      }
      
      setPagination({
        total: response.data.pagination.total,
        hasMore: response.data.pagination.hasMore,
      });
      
      const nextDrafts: Record<number, string> = {};
      newEntities
        .filter((entity) => entity.entityType === 'Document')
        .forEach((entity) => {
          nextDrafts[entity.entityId] = entity.content ?? '';
        });
      if (append) {
        setDocumentDrafts(prev => ({ ...prev, ...nextDrafts }));
      } else {
        setDocumentDrafts(nextDrafts);
      }
      return newEntities;
    } catch (error) {
      console.error('Failed to load entities', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreEntities = useCallback(() => {
    if (pagination.hasMore && !isLoading) {
      loadEntities(true, entities.length);
    }
  }, [pagination.hasMore, isLoading, entities.length]);

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

  // Get unique entity types for autocomplete from API
  const existingTypes = useMemo(() => {
    const types = new Set(entityTypes.map((e) => e.entityType));
    // Add common defaults if not present
    ['User', 'Customer', 'Equipment', 'Contact', 'Agent', 'Document'].forEach((t) => types.add(t));
    return Array.from(types).sort();
  }, [entityTypes]);

  // Filter types for dropdown based on input
  const filteredTypes = useMemo(() => {
    if (!newEntityType) return existingTypes;
    const lower = newEntityType.toLowerCase();
    return existingTypes.filter((t) => t.toLowerCase().includes(lower));
  }, [existingTypes, newEntityType]);

  // Group entities by type
  const entitiesByType = useMemo(() => {
    const grouped: Record<string, Entity[]> = {};
    entities.forEach((e) => {
      if (!grouped[e.entityType]) {
        grouped[e.entityType] = [];
      }
      grouped[e.entityType].push(e);
    });
    return grouped;
  }, [entities]);

  const sortedTypes = useMemo(() => Object.keys(entitiesByType).sort(), [entitiesByType]);

  const toggleTypeCollapse = (type: string) => {
    setCollapsedTypes((prev) => {
      // If 'all' collapsed, expand just this type (collapse all others)
      if (prev === 'all') {
        const allTypes = new Set(sortedTypes);
        allTypes.delete(type);
        return allTypes;
      }
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const selectType = (type: string) => {
    setNewEntityType(type);
    setShowTypeDropdown(false);
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>Entity Library</span>
        <span style={{ 
          fontSize: '10px', 
          fontWeight: 400, 
          color: 'var(--text-muted)',
          textTransform: 'none',
          letterSpacing: 'normal',
        }}>
          {entities.length}{pagination.total > entities.length ? ` of ${pagination.total.toLocaleString()}` : pagination.total > 0 ? ` (${pagination.total.toLocaleString()})` : ''}
        </span>
      </h2>

      {/* Sync Panel - Collapsible with warning */}
      <div style={{ 
        marginBottom: '10px', 
        border: '1px solid var(--border)', 
        borderRadius: '4px',
        backgroundColor: 'var(--bg-elevated)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowSyncPanel(!showSyncPanel)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '10px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{showSyncPanel ? '▼' : '▶'}</span>
            <span>🔄 e-automate Sync</span>
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Admin</span>
        </button>
        {showSyncPanel && (
          <div style={{ padding: '0 8px 8px 8px' }}>
            <div style={{ 
              fontSize: '10px', 
              color: '#996600', 
              backgroundColor: 'rgba(255, 193, 7, 0.15)', 
              padding: '6px 8px', 
              borderRadius: '4px', 
              marginBottom: '8px',
              border: '1px solid rgba(255, 193, 7, 0.3)',
            }}>
              ⚠️ Sync operations may take several minutes and affect many records.
            </div>
            <SyncPanel onSyncComplete={() => { loadEntities(); loadEntityTypes(); }} />
          </div>
        )}
      </div>

      {/* Create Entity - Collapsible */}
      <div style={{ 
        marginBottom: '10px', 
        border: '1px solid var(--border)', 
        borderRadius: '4px',
        backgroundColor: 'var(--bg-elevated)',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            cursor: 'pointer',
          }}
        >
          <span>➕ Add Entity</span>
          <span style={{ fontSize: '10px' }}>{showAddForm ? '▲' : '▼'}</span>
        </button>
        {showAddForm && (
          <div style={{ padding: '0 8px 8px 8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                ref={typeInputRef}
                type="text"
                placeholder="Entity type (e.g., Person, Machine)"
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value)}
                onFocus={() => setShowTypeDropdown(true)}
                onBlur={() => setTimeout(() => setShowTypeDropdown(false), 150)}
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
              {showTypeDropdown && filteredTypes.length > 0 && (
                <ul style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                  {filteredTypes.map((type) => (
                    <li
                      key={type}
                      onMouseDown={() => selectType(type)}
                      style={{
                        padding: '5px 8px',
                        fontSize: '11px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        backgroundColor: type === newEntityType ? 'var(--accent-muted)' : 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = type === newEntityType ? 'var(--accent-muted)' : 'transparent')}
                    >
                      {type}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
        )}
      </div>

      {/* Filter & Search */}
      <select
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
      >
        <option value="">All Types ({entityTypes.reduce((sum, t) => sum + t.count, 0).toLocaleString()})</option>
        {entityTypes.map(t => (
          <option key={t.entityType} value={t.entityType}>
            {t.entityType} ({t.count.toLocaleString()})
          </option>
        ))}
      </select>
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

      {/* Entities List - Grouped by Type */}
      <h3 style={{ 
        color: 'var(--text-muted)', 
        fontSize: '10px', 
        fontWeight: 600, 
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '6px',
      }}>Entities <span style={{ color: 'var(--accent)', fontFamily: "'Consolas', monospace" }}>({entities.length})</span></h3>
      
      {sortedTypes.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '10px', textAlign: 'center' }}>
          No entities yet. Add one above!
        </div>
      ) : (
        sortedTypes.map((type) => (
          <div key={type} style={{ marginBottom: '8px' }}>
            <button
              onClick={() => toggleTypeCollapse(type)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: (collapsedTypes === 'all' || collapsedTypes.has(type)) ? '0' : '4px',
              }}
            >
              <span>{type} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({entitiesByType[type].length})</span></span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{(collapsedTypes === 'all' || collapsedTypes.has(type)) ? '▶' : '▼'}</span>
            </button>
            {!(collapsedTypes === 'all' || collapsedTypes.has(type)) && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, paddingLeft: '8px' }}>
                {entitiesByType[type].map((e) => (
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
                          onChange={(ev) => setEditName(ev.target.value)}
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
                          {/* State color indicator for customers */}
                          {e.entityType === 'Customer' && (() => {
                            const state = getEntityState(e);
                            if (state) {
                              return (
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: getStateColor(state),
                                    flexShrink: 0,
                                  }}
                                  title={state}
                                />
                              );
                            }
                            return null;
                          })()}
                          <strong 
                            onClick={() => onEntitySelect?.(e.entityId)}
                            style={{ 
                              color: 'var(--text)', 
                              fontSize: '11px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              flex: '1', 
                              minWidth: 0,
                              cursor: onEntitySelect ? 'pointer' : 'default',
                            }}
                            title={onEntitySelect ? 'Click to find in 3D view' : undefined}
                          >{e.displayName}</strong>
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
            )}
          </div>
        ))
      )}

      {/* Load More button */}
      {pagination.hasMore && (
        <div style={{ 
          padding: '10px', 
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
          marginTop: '10px',
        }}>
          <button
            onClick={loadMoreEntities}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text)',
              cursor: isLoading ? 'wait' : 'pointer',
              width: '100%',
            }}
          >
            {isLoading ? 'Loading...' : `Load More (${entities.length.toLocaleString()} of ${pagination.total.toLocaleString()})`}
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && entities.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading entities...
        </div>
      )}
    </div>
  );
};
