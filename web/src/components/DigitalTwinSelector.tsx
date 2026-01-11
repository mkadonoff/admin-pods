import { useState, useEffect } from 'react';
import { digitalTwinAPI, DigitalTwin } from '../api';

interface DigitalTwinSelectorProps {
  currentDigitalTwinId: number | null;
  onDigitalTwinChange: (digitalTwinId: number) => void;
}

export default function DigitalTwinSelector({ 
  currentDigitalTwinId, 
  onDigitalTwinChange 
}: DigitalTwinSelectorProps) {
  const [digitalTwins, setDigitalTwins] = useState<DigitalTwin[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadDigitalTwins();
  }, []);

  const loadDigitalTwins = async () => {
    try {
      const response = await digitalTwinAPI.list();
      setDigitalTwins(response.data);
      
      // Auto-select first digital twin if none selected
      if (!currentDigitalTwinId && response.data.length > 0) {
        onDigitalTwinChange(response.data[0].digitalTwinId);
      }
    } catch (error) {
      console.error('Failed to load digital twins:', error);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    setLoading(true);
    try {
      const response = await digitalTwinAPI.create({
        name: newName,
        description: newDescription || undefined
      });
      
      setDigitalTwins([...digitalTwins, response.data]);
      onDigitalTwinChange(response.data.digitalTwinId);
      setShowCreateDialog(false);
      setNewName('');
      setNewDescription('');
    } catch (error) {
      console.error('Failed to create digital twin:', error);
      alert('Failed to create digital twin');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this digital twin? This will delete all towers, floors, rings, pods, and entities.')) {
      return;
    }
    
    try {
      await digitalTwinAPI.delete(id);
      const remaining = digitalTwins.filter(dt => dt.digitalTwinId !== id);
      setDigitalTwins(remaining);
      
      if (currentDigitalTwinId === id && remaining.length > 0) {
        onDigitalTwinChange(remaining[0].digitalTwinId);
      }
    } catch (error) {
      console.error('Failed to delete digital twin:', error);
      alert('Failed to delete digital twin');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <label>Digital Twin:</label>
      <select
        value={currentDigitalTwinId || ''}
        onChange={(e) => onDigitalTwinChange(parseInt(e.target.value))}
        style={{ padding: '0.5rem', fontSize: '1rem' }}
      >
        <option value="">Select Digital Twin</option>
        {digitalTwins.map(dt => (
          <option key={dt.digitalTwinId} value={dt.digitalTwinId}>
            {dt.name} ({dt._count?.towers || 0} towers)
          </option>
        ))}
      </select>
      
      <button onClick={() => setShowCreateDialog(true)}>+ New</button>
      
      {currentDigitalTwinId && (
        <button 
          onClick={() => handleDelete(currentDigitalTwinId)}
          style={{ color: 'red' }}
        >
          Delete
        </button>
      )}
      
      {showCreateDialog && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            padding: '2rem', 
            borderRadius: '8px',
            minWidth: '400px'
          }}>
            <h2>Create Digital Twin</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label>Name:</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Description (optional):</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', minHeight: '80px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateDialog(false)}>Cancel</button>
              <button onClick={handleCreate} disabled={loading || !newName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
