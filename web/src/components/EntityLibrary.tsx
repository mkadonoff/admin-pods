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
    <div style={{ padding: '20px', borderLeft: '1px solid #ccc', width: '250px', overflowY: 'auto' }}>
      <h2>Entity Library</h2>

      {/* Create Entity */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Add Entity</h3>
        <input
          type="text"
          placeholder="Entity type (e.g., Person, Machine)"
          value={newEntityType}
          onChange={(e) => setNewEntityType(e.target.value)}
          style={{ width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <input
          type="text"
          placeholder="Entity name"
          value={newEntityName}
          onChange={(e) => setNewEntityName(e.target.value)}
          style={{ width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <button onClick={handleCreateEntity} style={{ width: '100%' }}>Add Entity</button>
      </div>

      {/* Filter & Search */}
      <input
        type="text"
        placeholder="Filter by type"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
      />
      <input
        type="text"
        placeholder="Search name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
      />

      {/* Entities List */}
      <h3>Entities ({entities.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entities.map((e) => (
          <li
            key={e.entityId}
            style={{
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
            }}
          >
            {editingId === e.entityId ? (
              <div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => handleSaveEdit(e.entityId)}
                  style={{
                    marginRight: '5px',
                    padding: '4px 8px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#757575',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <strong>{e.displayName}</strong> <br />
                <small style={{ color: '#666' }}>({e.entityType})</small>
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => handleEditEntity(e.entityId, e.displayName)}
                    style={{
                      marginRight: '5px',
                      padding: '4px 8px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEntity(e.entityId, e.displayName)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
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
