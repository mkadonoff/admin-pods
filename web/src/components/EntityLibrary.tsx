import React, { useState, useEffect } from 'react';
import { entityAPI } from '../api';

interface Entity {
  entityId: number;
  displayName: string;
  entityType: string;
}

export const EntityLibrary: React.FC = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [newEntityType, setNewEntityType] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadEntities();
  }, [filter, search]);

  const loadEntities = async () => {
    try {
      const response = await entityAPI.list(filter || undefined, search || undefined);
      setEntities(response.data);
    } catch (error) {
      console.error('Failed to load entities', error);
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
      loadEntities();
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
      loadEntities();
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
      loadEntities();
    } catch (error: any) {
      console.error('Failed to delete entity:', error);
      alert(`Error deleting entity: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ 
      padding: '16px', 
      borderLeft: '1px solid var(--border)', 
      width: '280px', 
      overflowY: 'auto',
      backgroundColor: 'var(--bg-surface)',
      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    }}>
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
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        border: '1px solid var(--border)', 
        borderRadius: '6px',
        backgroundColor: 'var(--bg-elevated)',
      }}>
        <h3 style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600, marginBottom: '10px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add Entity</h3>
        <input
          type="text"
          placeholder="Entity type (e.g., Person, Machine)"
          value={newEntityType}
          onChange={(e) => setNewEntityType(e.target.value)}
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
          placeholder="Entity name"
          value={newEntityName}
          onChange={(e) => setNewEntityName(e.target.value)}
          style={{ 
            width: '100%', 
            marginBottom: '10px', 
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px',
            borderRadius: '4px',
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
            padding: '8px',
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
                      marginRight: '5px',
                      padding: '4px 8px',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEntity(e.entityId, e.displayName)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
