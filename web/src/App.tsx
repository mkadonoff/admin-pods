import { useEffect, useState, useCallback, useMemo } from 'react';
import './App.css';
import arpogeLogo from './assets/arpoge-logo.png';
import { LayoutView } from './components/LayoutView';
import { MyPresenceBar } from './components/MyPresenceBar';
import { ContextPanel } from './components/ContextPanel';
import { FloorManager } from './components/FloorManager';
import { EntityLibrary } from './components/EntityLibrary';
import { floorAPI, assemblyAPI, healthAPI, Assembly, Floor, ApiHealth } from './api';

const PRESENCE_STORAGE_KEY = 'arpoge_my_person_entity_id';

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
  const [myPersonEntityId, setMyPersonEntityId] = useState<number | null>(null);
  const [entityVersion, setEntityVersion] = useState(0);
  const [healthStatus, setHealthStatus] = useState<ApiHealth | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
    if (!stored) return;
    const parsed = parseInt(stored, 10);
    if (!Number.isNaN(parsed)) {
      setMyPersonEntityId(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (myPersonEntityId) {
      window.localStorage.setItem(PRESENCE_STORAGE_KEY, String(myPersonEntityId));
    } else {
      window.localStorage.removeItem(PRESENCE_STORAGE_KEY);
    }
  }, [myPersonEntityId]);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const response = await healthAPI.status();
        if (!cancelled) {
          setHealthStatus(response.data);
          setHealthFailed(false);
        }
      } catch (error) {
        if (!cancelled) {
          setHealthFailed(true);
          setHealthStatus(null);
        }
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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

  const notifyEntitiesChanged = () => {
    setEntityVersion((v) => v + 1);
  };

  const handleFloorsChanged = () => {
    if (assemblies.length > 0) {
      refreshFloors(assemblies.map((a) => a.assemblyId));
    }
    refreshAssemblies(); // Update floor counts
  };

  const handleSelectFloor = (floorId: number) => {
    setSelectedFloorId(floorId);
    setSelectedPodId(null);
  };

  const handleSelectAssembly = (assemblyId: number) => {
    setActiveAssemblyId(assemblyId);
    setSelectedFloorId(null);
    setSelectedPodId(null);
  };

  // Find assembly and floor for selected pod
  const selectedPodInfo = useMemo(() => {
    if (!selectedPodId) {
      return { assemblyName: undefined, floorName: undefined, podName: undefined };
    }

    for (const floor of floors) {
      for (const ring of floor.rings || []) {
        for (const pod of ring.pods || []) {
          if (pod.podId === selectedPodId) {
            const assembly = assemblies.find((a) => a.assemblyId === floor.assemblyId);
            return {
              assemblyName: assembly?.name,
              floorName: floor.name,
              podName: pod.name || '',
            };
          }
        }
      }
    }

    return { assemblyName: undefined, floorName: undefined, podName: undefined };
  }, [selectedPodId, floors, assemblies]);

  const myPresenceInfo = useMemo(() => {
    if (!myPersonEntityId) {
      return { podId: null as number | null, podName: undefined as string | undefined };
    }

    for (const floor of floors) {
      for (const ring of floor.rings || []) {
        for (const pod of ring.pods || []) {
          const hasMe = (pod.assignments || []).some((assignment) => assignment.entityId === myPersonEntityId);
          if (hasMe) {
            return { podId: pod.podId, podName: pod.name || 'Pod' };
          }
        }
      }
    }

    return { podId: null as number | null, podName: undefined as string | undefined };
  }, [myPersonEntityId, floors]);

  const apiHealthy = healthStatus?.status === 'ok' && !healthFailed;
  const healthBadgeText = healthFailed
    ? 'API Unreachable'
    : healthStatus
      ? `${healthStatus.environment} · ${healthStatus.status === 'ok' ? 'API OK' : 'API Issue'}`
      : 'Checking API...';
  const healthBadgeColor = apiHealthy ? '#107c10' : healthFailed ? '#a4262c' : '#605e5c';
  const healthBadgeBackground = apiHealthy
    ? 'rgba(16,124,16,0.15)'
    : healthFailed
      ? 'rgba(164,38,44,0.15)'
      : 'rgba(96,94,92,0.15)';

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
            <div
              style={{
                fontSize: '11px',
                color: healthBadgeColor,
                fontFamily: "'Consolas', 'SF Mono', monospace",
                padding: '2px 8px',
                backgroundColor: healthBadgeBackground,
                borderRadius: '4px',
                border: `1px solid ${healthBadgeColor}`,
              }}
            >
              {healthBadgeText}
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

      <MyPresenceBar
        selectedEntityId={myPersonEntityId}
        onSelectEntity={setMyPersonEntityId}
        podName={myPresenceInfo.podName}
        refreshKey={entityVersion}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            flex: '0 0 320px',
            minWidth: '280px',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            padding: '6px 8px',
            boxSizing: 'border-box',
          }}
        >
          <FloorManager
            variant="sidebar"
            assemblies={assemblies}
            floors={floors}
            activeAssemblyId={activeAssemblyId}
            selectedFloorId={selectedFloorId}
            onSelectAssembly={handleSelectAssembly}
            onSelectFloor={handleSelectFloor}
            onDeleteAssembly={handleDeleteAssembly}
            onRenameAssembly={handleRenameAssembly}
            onFloorsChanged={handleFloorsChanged}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            style={{
              flex: '0 0 58%',
              minHeight: 320,
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <LayoutView
              assemblies={assemblies}
              floors={floors}
              activeAssemblyId={activeAssemblyId}
              selectedFloorId={selectedFloorId}
              selectedPodId={selectedPodId}
              onPodSelect={setSelectedPodId}
              assignmentsVersion={assignmentsVersion}
              onLayoutChanged={handleFloorsChanged}
              presencePodId={myPresenceInfo.podId}
            />
          </div>
          <ContextPanel
            assemblies={assemblies}
            floors={floors}
            selectedFloorId={selectedFloorId}
            selectedPodId={selectedPodId}
            selectedPodInfo={selectedPodInfo}
            onLayoutChanged={handleFloorsChanged}
            onPodSelect={setSelectedPodId}
            onAssignmentsChanged={notifyAssignmentsChanged}
            onPodUpdated={handleFloorsChanged}
            onClearPodSelection={() => setSelectedPodId(null)}
          />
        </div>

        <div
          style={{
            flex: '0 0 320px',
            minWidth: '260px',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <EntityLibrary variant="sidebar" onEntitiesChanged={notifyEntitiesChanged} />
        </div>
      </div>
    </div>
  );
}

export default App;
