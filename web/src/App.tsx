import { useEffect, useState, useCallback, useMemo } from 'react';
import './App.css';
import arpogeLogo from './assets/arpoge-logo.png';
import { FloorManager } from './components/FloorManager';
import { LayoutView } from './components/LayoutView';
import { PodDetailDrawer } from './components/PodDetailDrawer';
import { EntityLibrary } from './components/EntityLibrary';
import { floorAPI, assemblyAPI, Assembly, Floor } from './api';

function App() {
  const gitCommit = import.meta.env.VITE_GIT_COMMIT;
  const versionLabel = gitCommit ? gitCommit.slice(0, 7) : 'dev';
  // Assembly state
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [activeAssemblyId, setActiveAssemblyId] = useState<number | null>(null);
  const [newAssemblyName, setNewAssemblyName] = useState('');

  // Floor state (all floors from all assemblies)
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<number | null>(null);
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);

  // Load assemblies
  const refreshAssemblies = useCallback(async () => {
    try {
      const response = await assemblyAPI.list();
      setAssemblies(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to load assemblies', error);
      return [];
    }
  }, []);

  // Load floors for all assemblies
  const refreshFloors = useCallback(async (assemblyIds: number[]) => {
    if (assemblyIds.length === 0) {
      setFloors([]);
      return;
    }
    try {
      const response = await floorAPI.list(assemblyIds);
      setFloors(response.data);
    } catch (error) {
      console.error('Failed to load floors', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      const loadedAssemblies = await refreshAssemblies();
      if (loadedAssemblies.length > 0) {
        const ids = loadedAssemblies.map((a: Assembly) => a.assemblyId);
        setActiveAssemblyId(ids[0]);
        await refreshFloors(ids);
      }
    })();
  }, []);

  // Reload floors when assemblies change
  useEffect(() => {
    if (assemblies.length > 0) {
      const ids = assemblies.map((a) => a.assemblyId);
      refreshFloors(ids);
    }
  }, [assemblies, refreshFloors]);

  // Create new assembly
  const handleCreateAssembly = async () => {
    const name = newAssemblyName.trim();
    if (!name) {
      alert('Please enter an assembly name');
      return;
    }
    try {
      const response = await assemblyAPI.create(name);
      setNewAssemblyName('');
      await refreshAssemblies();
      setActiveAssemblyId(response.data.assemblyId);
    } catch (error: any) {
      console.error('Failed to create assembly', error);
      alert(error.response?.data?.error || 'Failed to create assembly');
    }
  };

  // Delete assembly
  const handleDeleteAssembly = async (assemblyId: number) => {
    const assembly = assemblies.find((a) => a.assemblyId === assemblyId);
    if (!confirm(`Delete assembly "${assembly?.name}"? This will delete all floors and pods.`)) return;
    try {
      await assemblyAPI.delete(assemblyId);
      if (activeAssemblyId === assemblyId) {
        setActiveAssemblyId(assemblies.find((a) => a.assemblyId !== assemblyId)?.assemblyId ?? null);
      }
      await refreshAssemblies();
    } catch (error) {
      console.error('Failed to delete assembly', error);
      alert('Failed to delete assembly');
    }
  };

  // Rename assembly
  const handleRenameAssembly = async (assemblyId: number, newName: string) => {
    try {
      await assemblyAPI.update(assemblyId, newName);
      await refreshAssemblies();
    } catch (error: any) {
      console.error('Failed to rename assembly', error);
      alert(error.response?.data?.error || 'Failed to rename assembly');
    }
  };

  const notifyAssignmentsChanged = () => {
    setAssignmentsVersion((v) => v + 1);
    // Refresh floors to get updated assignment data
    if (assemblies.length > 0) {
      refreshFloors(assemblies.map((a) => a.assemblyId));
    }
  };

  const handleFloorsChanged = () => {
    if (assemblies.length > 0) {
      refreshFloors(assemblies.map((a) => a.assemblyId));
    }
    refreshAssemblies(); // Update floor counts
  };

  // Find assembly and floor for selected pod
  const selectedPodInfo = useMemo(() => {
    if (!selectedPodId) return { assemblyName: undefined, floorName: undefined };
    for (const floor of floors) {
      for (const ring of floor.rings || []) {
        for (const pod of ring.pods || []) {
          if (pod.podId === selectedPodId) {
            const assembly = assemblies.find(a => a.assemblyId === floor.assemblyId);
            return { assemblyName: assembly?.name, floorName: floor.name };
          }
        }
      }
    }
    return { assemblyName: undefined, floorName: undefined };
  }, [selectedPodId, floors, assemblies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={arpogeLogo} alt="Arpoge" style={{ height: '28px', width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.3px' }}>
              ARPOGE Digital Twin Studio
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--accent)', 
              fontFamily: "'Consolas', 'SF Mono', monospace",
              padding: '2px 8px',
              backgroundColor: 'var(--accent-light)',
              borderRadius: '4px',
            }}>
              {versionLabel}
            </div>
          </div>
        </div>

        {/* Assembly controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="New assembly name"
            value={newAssemblyName}
            onChange={(e) => setNewAssemblyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAssembly()}
            style={{ 
              padding: '6px 10px', 
              width: '180px',
            }}
          />
          <button 
            onClick={handleCreateAssembly} 
            style={{ 
              padding: '6px 14px',
              backgroundColor: 'var(--accent)',
              border: '1px solid var(--accent)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            + Assembly
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <FloorManager
          assemblies={assemblies}
          floors={floors}
          activeAssemblyId={activeAssemblyId}
          selectedFloorId={selectedFloorId}
          onSelectAssembly={setActiveAssemblyId}
          onSelectFloor={setSelectedFloorId}
          onDeleteAssembly={handleDeleteAssembly}
          onRenameAssembly={handleRenameAssembly}
          onFloorsChanged={handleFloorsChanged}
        />
        <LayoutView
          assemblies={assemblies}
          floors={floors}
          activeAssemblyId={activeAssemblyId}
          selectedFloorId={selectedFloorId}
          selectedPodId={selectedPodId}
          onPodSelect={setSelectedPodId}
          assignmentsVersion={assignmentsVersion}
          onLayoutChanged={handleFloorsChanged}
        />
        <EntityLibrary />
        <PodDetailDrawer
          podId={selectedPodId}
          assemblyName={selectedPodInfo.assemblyName}
          floorName={selectedPodInfo.floorName}
          onClose={() => setSelectedPodId(null)}
          onAssignmentsChanged={notifyAssignmentsChanged}
        />
      </div>
    </div>
  );
}

export default App;
