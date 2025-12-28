import React, { useState } from 'react';
import { floorAPI, Assembly, Floor } from '../api';

interface FloorManagerProps {
  assemblies: Assembly[];
  floors: Floor[];
  activeAssemblyId: number | null;
  selectedFloorId: number | null;
  onSelectAssembly: (id: number) => void;
  onSelectFloor: (id: number) => void;
  onDeleteAssembly: (id: number) => void;
  onRenameAssembly: (id: number, newName: string) => void;
  onFloorsChanged: () => void;
}

export const FloorManager: React.FC<FloorManagerProps> = ({
  assemblies,
  floors,
  activeAssemblyId,
  selectedFloorId,
  onSelectAssembly,
  onSelectFloor,
  onDeleteAssembly,
  onRenameAssembly,
  onFloorsChanged,
}) => {
  const [newFloorName, setNewFloorName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState<number | null>(null);
  const [editFloorName, setEditFloorName] = useState('');
  const [editingAssemblyId, setEditingAssemblyId] = useState<number | null>(null);
  const [editAssemblyName, setEditAssemblyName] = useState('');

  const handleAddFloor = async () => {
    if (!newFloorName || !activeAssemblyId) return;
    try {
      const assemblyFloors = floors.filter((f) => f.assemblyId === activeAssemblyId);
      await floorAPI.create({
        name: newFloorName,
        orderIndex: assemblyFloors.length,
        assemblyId: activeAssemblyId,
      });
      setNewFloorName('');
      onFloorsChanged();
    } catch (error) {
      console.error('Failed to create floor', error);
    }
  };

  const handleReorder = async (floorId: number, direction: 'up' | 'down') => {
    const floor = floors.find((f) => f.floorId === floorId);
    if (!floor) return;

    const newOrder = direction === 'up' ? floor.orderIndex - 1 : floor.orderIndex + 1;
    try {
      await floorAPI.update(floorId, { orderIndex: newOrder });
      onFloorsChanged();
    } catch (error) {
      console.error('Failed to reorder floor', error);
    }
  };

  const handleEditFloor = (floorId: number, currentName: string) => {
    setEditingFloorId(floorId);
    setEditFloorName(currentName);
  };

  const handleSaveFloorEdit = async (floorId: number) => {
    if (!editFloorName) {
      alert('Please enter a floor name');
      return;
    }
    try {
      await floorAPI.update(floorId, { name: editFloorName });
      setEditingFloorId(null);
      onFloorsChanged();
    } catch (error: any) {
      console.error('Failed to update floor:', error);
      alert(`Error updating floor: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteFloor = async (floorId: number, floorName: string) => {
    if (!window.confirm(`Delete floor "${floorName}"? This will delete all rings and pods.`)) {
      return;
    }
    try {
      await floorAPI.delete(floorId);
      onFloorsChanged();
    } catch (error: any) {
      console.error('Failed to delete floor:', error);
      alert(`Error deleting floor: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleEditAssembly = (assemblyId: number, currentName: string) => {
    setEditingAssemblyId(assemblyId);
    setEditAssemblyName(currentName);
  };

  const handleSaveAssemblyEdit = (assemblyId: number) => {
    if (!editAssemblyName.trim()) {
      alert('Please enter an assembly name');
      return;
    }
    onRenameAssembly(assemblyId, editAssemblyName.trim());
    setEditingAssemblyId(null);
  };

  return (
    <div style={{ padding: '20px', borderRight: '1px solid #ccc', width: '280px', overflowY: 'auto' }}>
      <h2>Assemblies & Floors</h2>

      {assemblies.length === 0 && (
        <p style={{ color: '#666', fontSize: '14px' }}>No assemblies. Create one to get started!</p>
      )}

      {assemblies.map((assembly) => {
        const assemblyFloors = floors
          .filter((f) => f.assemblyId === assembly.assemblyId)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const isActive = activeAssemblyId === assembly.assemblyId;

        return (
          <div
            key={assembly.assemblyId}
            style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: isActive ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '8px',
              border: isActive ? '2px solid #1976d2' : '1px solid #ddd',
            }}
          >
            {/* Assembly Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              {editingAssemblyId === assembly.assemblyId ? (
                <>
                  <input
                    type="text"
                    value={editAssemblyName}
                    onChange={(e) => setEditAssemblyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAssemblyEdit(assembly.assemblyId)}
                    style={{ flex: 1, marginRight: '5px' }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveAssemblyEdit(assembly.assemblyId)}>✓</button>
                  <button onClick={() => setEditingAssemblyId(null)}>✕</button>
                </>
              ) : (
                <>
                  <strong
                    onClick={() => onSelectAssembly(assembly.assemblyId)}
                    style={{ flex: 1, cursor: 'pointer' }}
                  >
                    {assembly.name}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>
                    ({assemblyFloors.length} floors)
                  </span>
                  <button
                    onClick={() => handleEditAssembly(assembly.assemblyId, assembly.name)}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeleteAssembly(assembly.assemblyId)}
                    title="Delete"
                    style={{ color: '#d32f2f' }}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>

            {/* Floors list */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {assemblyFloors.map((floor) => (
                <li
                  key={floor.floorId}
                  style={{
                    marginBottom: '6px',
                    padding: '6px 8px',
                    backgroundColor: selectedFloorId === floor.floorId ? '#bbdefb' : '#fff',
                    borderRadius: '4px',
                    border: selectedFloorId === floor.floorId ? '1px solid #1976d2' : '1px solid #ddd',
                  }}
                >
                  {editingFloorId === floor.floorId ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        value={editFloorName}
                        onChange={(e) => setEditFloorName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveFloorEdit(floor.floorId)}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveFloorEdit(floor.floorId)}>✓</button>
                      <button onClick={() => setEditingFloorId(null)}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        onClick={() => onSelectFloor(floor.floorId)}
                        style={{ flex: 1, cursor: 'pointer' }}
                      >
                        {floor.name}
                      </span>
                      <button onClick={() => handleEditFloor(floor.floorId, floor.name)} title="Rename">
                        ✏️
                      </button>
                      <button onClick={() => handleReorder(floor.floorId, 'up')} title="Move up">
                        ↑
                      </button>
                      <button onClick={() => handleReorder(floor.floorId, 'down')} title="Move down">
                        ↓
                      </button>
                      <button
                        onClick={() => handleDeleteFloor(floor.floorId, floor.name)}
                        title="Delete"
                        style={{ color: '#d32f2f' }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Add floor (only for active assembly) */}
            {isActive && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="New floor name"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
                  style={{ flex: 1, padding: '4px 8px' }}
                />
                <button onClick={handleAddFloor}>+ Floor</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
