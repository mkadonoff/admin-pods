import React, { useState, useEffect } from 'react';
import { floorAPI } from '../api';

interface Floor {
  floorId: number;
  name: string;
  orderIndex: number;
}

export const FloorManager: React.FC<{ onFloorSelect: (id: number) => void }> = ({ onFloorSelect }) => {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [newFloorName, setNewFloorName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadFloors();
  }, []);

  const loadFloors = async () => {
    try {
      const response = await floorAPI.list();
      setFloors(response.data);
    } catch (error) {
      console.error('Failed to load floors', error);
    }
  };

  const handleAddFloor = async () => {
    if (!newFloorName) return;
    try {
      await floorAPI.create({
        name: newFloorName,
        orderIndex: floors.length,
      });
      setNewFloorName('');
      loadFloors();
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
      loadFloors();
    } catch (error) {
      console.error('Failed to reorder floor', error);
    }
  };

  const handleEditFloor = (floorId: number, currentName: string) => {
    setEditingId(floorId);
    setEditName(currentName);
  };

  const handleSaveEdit = async (floorId: number) => {
    if (!editName) {
      alert('Please enter a floor name');
      return;
    }
    try {
      await floorAPI.update(floorId, { name: editName });
      setEditingId(null);
      loadFloors();
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
      loadFloors();
    } catch (error: any) {
      console.error('Failed to delete floor:', error);
      alert(`Error deleting floor: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', borderRight: '1px solid #ccc', width: '250px' }}>
      <h2>Floors</h2>
      <ul>
        {floors.map((floor) => (
          <li key={floor.floorId} style={{ marginBottom: '10px' }}>
            {editingId === floor.floorId ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginRight: '5px' }}
                />
                <button onClick={() => handleSaveEdit(floor.floorId)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => onFloorSelect(floor.floorId)}>{floor.name}</button>
                <button onClick={() => handleEditFloor(floor.floorId, floor.name)}>✏️</button>
                <button onClick={() => handleReorder(floor.floorId, 'up')}>↑</button>
                <button onClick={() => handleReorder(floor.floorId, 'down')}>↓</button>
                <button onClick={() => handleDeleteFloor(floor.floorId, floor.name)} style={{ color: '#d32f2f' }}>🗑️</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <input
        type="text"
        placeholder="New floor name"
        value={newFloorName}
        onChange={(e) => setNewFloorName(e.target.value)}
      />
      <button onClick={handleAddFloor}>Add Floor</button>
    </div>
  );
};
