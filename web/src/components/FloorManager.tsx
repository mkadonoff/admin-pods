import React, { useState } from 'react';
import { floorAPI, Tower, Floor } from '../api';

interface FloorManagerProps {
  towers: Tower[];
  floors: Floor[];
  activeTowerId: number | null;
  selectedFloorId: number | null;
  onSelectTower: (id: number) => void;
  onSelectFloor: (id: number) => void;
  onDeleteTower: (id: number) => void;
  onRenameTower: (id: number, newName: string) => void;
  onFloorsChanged: () => void;
  variant?: 'sidebar' | 'panel';
}

export const FloorManager: React.FC<FloorManagerProps> = ({
  towers,
  floors,
  activeTowerId,
  selectedFloorId,
  onSelectTower,
  onSelectFloor,
  onDeleteTower,
  onRenameTower,
  onFloorsChanged,
  variant = 'sidebar',
}) => {
  const [newFloorName, setNewFloorName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState<number | null>(null);
  const [editFloorName, setEditFloorName] = useState('');
  const [editingTowerId, setEditingTowerId] = useState<number | null>(null);
  const [editTowerName, setEditTowerName] = useState('');
  const isPanelVariant = variant === 'panel';
  const containerStyle = {
    padding: '16px',
    borderRight: isPanelVariant ? 'none' : '1px solid var(--border)',
    width: '100%',
    overflowY: 'auto' as const,
    backgroundColor: 'var(--bg-surface)',
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    border: isPanelVariant ? '1px solid var(--border)' : undefined,
    borderRadius: isPanelVariant ? '10px' : undefined,
    boxShadow: isPanelVariant ? '0 2px 6px rgba(0,0,0,0.06)' : undefined,
    height: '100%',
    boxSizing: 'border-box' as const,
  };

  const handleAddFloor = async () => {
    if (!newFloorName || !activeTowerId) return;
    try {
      const TowerFloors = floors.filter((f) => f.TowerId === activeTowerId);
      await floorAPI.create({
        name: newFloorName,
        orderIndex: TowerFloors.length,
        TowerId: activeTowerId,
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

    // Get all floors in the same Tower, sorted by orderIndex ascending (bottom to top)
    const TowerFloors = floors
      .filter((f) => f.TowerId === floor.TowerId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const currentIndex = TowerFloors.findIndex((f) => f.floorId === floorId);
    
    // Determine target index based on direction (up = higher index, higher orderIndex)
    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    
    // Check bounds
    if (targetIndex < 0 || targetIndex >= TowerFloors.length) return;

    const targetFloor = TowerFloors[targetIndex];

    // Swap orderIndex values - wait for both to complete before refreshing
    try {
      await Promise.all([
        floorAPI.update(floorId, { orderIndex: targetFloor.orderIndex }),
        floorAPI.update(targetFloor.floorId, { orderIndex: floor.orderIndex })
      ]);
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

  const handleEditTower = (TowerId: number, currentName: string) => {
    setEditingTowerId(TowerId);
    setEditTowerName(currentName);
  };

  const handleSaveTowerEdit = (TowerId: number) => {
    if (!editTowerName.trim()) {
      alert('Please enter an Tower name');
      return;
    }
    onRenameTower(TowerId, editTowerName.trim());
    setEditingTowerId(null);
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
      }}>towers & Floors</h2>

      {towers.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No towers. Create one to get started!</p>
      )}

      {towers.map((Tower) => {
        const TowerFloors = floors
          .filter((f) => f.TowerId === Tower.TowerId)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .reverse();
        const isActive = activeTowerId === Tower.TowerId;

        return (
          <div
            key={Tower.TowerId}
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: isActive ? 'var(--accent-light)' : 'var(--bg-elevated)',
              borderRadius: '6px',
              border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {/* Tower Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              {editingTowerId === Tower.TowerId ? (
                <>
                  <input
                    type="text"
                    value={editTowerName}
                    onChange={(e) => setEditTowerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTowerEdit(Tower.TowerId)}
                    style={{ flex: 1, marginRight: '5px' }}
                    autoFocus
                  />
                  <button onClick={() => handleSaveTowerEdit(Tower.TowerId)}>✓</button>
                  <button onClick={() => setEditingTowerId(null)}>✕</button>
                </>
              ) : (
                <>
                  <strong
                    onClick={() => onSelectTower(Tower.TowerId)}
                    style={{ flex: 1, cursor: 'pointer', color: 'var(--text)', fontSize: '12px' }}
                  >
                    {Tower.name}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px', fontFamily: "'Consolas', monospace" }}>
                    ({TowerFloors.length} floors)
                  </span>
                  <button
                    onClick={() => handleEditTower(Tower.TowerId, Tower.name)}
                    title="Rename"
                    style={{ padding: '4px 6px', fontSize: '12px' }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeleteTower(Tower.TowerId)}
                    title="Delete"
                    style={{ color: 'var(--danger)', padding: '4px 6px', fontSize: '12px' }}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>

            {/* Floors list */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {TowerFloors.map((floor) => (
                <li
                  key={floor.floorId}
                  style={{
                    marginBottom: '6px',
                    padding: '8px 10px',
                    backgroundColor: selectedFloorId === floor.floorId ? 'var(--accent-light)' : 'var(--bg-surface)',
                    borderRadius: '4px',
                    border: selectedFloorId === floor.floorId ? '1px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all 0.15s ease',
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
                        style={{ flex: 1, cursor: 'pointer', color: 'var(--text)', fontSize: '11px' }}
                      >
                        {floor.name}
                      </span>
                      <button onClick={() => handleEditFloor(floor.floorId, floor.name)} title="Rename" style={{ padding: '2px 5px', fontSize: '11px' }}>
                        ✏️
                      </button>
                      <button onClick={() => handleReorder(floor.floorId, 'up')} title="Move up" style={{ padding: '2px 5px', fontSize: '11px' }}>
                        ↑
                      </button>
                      <button onClick={() => handleReorder(floor.floorId, 'down')} title="Move down" style={{ padding: '2px 5px', fontSize: '11px' }}>
                        ↓
                      </button>
                      <button
                        onClick={() => handleDeleteFloor(floor.floorId, floor.name)}
                        title="Delete"
                        style={{ color: 'var(--danger)', padding: '2px 5px', fontSize: '11px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Add floor (only for active Tower) */}
            {isActive && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="New floor name"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
                  style={{ 
                    flex: 1, 
                    padding: '6px 8px',
                    fontSize: '12px',
                  }}
                />
                <button 
                  onClick={handleAddFloor}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >+ Floor</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
