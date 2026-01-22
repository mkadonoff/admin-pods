import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import './App.css';
import arpogeLogo from './assets/arpoge-logo.png';
import { LayoutView } from './components/LayoutView';
import { MyPresenceBar } from './components/MyPresenceBar';
import { ContextPanel } from './components/ContextPanel';
import { FloorManager } from './components/FloorManager';
import { EntityLibrary } from './components/EntityLibrary';
import DigitalTwinSelector from './components/DigitalTwinSelector';
import { floorAPI, towerAPI, healthAPI, Tower, Floor, ApiHealth } from './api';
import { NavigationState, NavAction, PodNavigationHUD } from './navigation';

const PRESENCE_STORAGE_KEY = 'arpoge_my_person_entity_id';

function App() {
  const gitCommit = import.meta.env.VITE_GIT_COMMIT;
  const versionLabel = gitCommit ? gitCommit.slice(0, 7) : 'dev';
  
  // Digital Twin state
  const [currentDigitalTwinId, setCurrentDigitalTwinId] = useState<number | null>(null);
  
  // Tower state
  const [towers, settowers] = useState<Tower[]>([]);
  const [activeTowerId, setActiveTowerId] = useState<number | null>(null);
  const [newTowerName, setNewTowerName] = useState('');

  // Floor state (all floors from all towers)
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<number | null>(null);
  const [showPodDetails, setShowPodDetails] = useState(false);
  const [processRequestNonce, setProcessRequestNonce] = useState(0);
  const [processRequestPodId, setProcessRequestPodId] = useState<number | null>(null);
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);
  const [myPersonEntityId, setMyPersonEntityId] = useState<number | null>(null);
  const [entityVersion, setEntityVersion] = useState(0);
  const [healthStatus, setHealthStatus] = useState<ApiHealth | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [centerSplitPercent, setCenterSplitPercent] = useState(50);
  const isDraggingRef = useRef(false);
  const centerContainerRef = useRef<HTMLDivElement>(null);
  
  // Pod navigation state (for HUD rendering in lower panel)
  const [podNavState, setPodNavState] = useState<NavigationState | null>(null);
  const podNavActionRef = useRef<((action: NavAction) => void) | null>(null);

  // Load towers
  const refreshtowers = useCallback(async () => {
    if (!currentDigitalTwinId) {
      settowers([]);
      return [];
    }
    try {
      const response = await towerAPI.list(currentDigitalTwinId);
      settowers(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to load towers', error);
      return [];
    }
  }, [currentDigitalTwinId]);

  // Load floors for all towers
  const refreshFloors = useCallback(async (TowerIds: number[]) => {
    if (TowerIds.length === 0) {
      setFloors([]);
      return;
    }
    try {
      const response = await floorAPI.list(TowerIds);
      setFloors(response.data);
    } catch (error) {
      console.error('Failed to load floors', error);
    }
  }, []);

  // Load towers when digital twin changes
  useEffect(() => {
    if (!currentDigitalTwinId) {
      settowers([]);
      setFloors([]);
      setActiveTowerId(null);
      return;
    }
    (async () => {
      const loadedtowers = await refreshtowers();
      if (loadedtowers.length > 0) {
        const ids = loadedtowers.map((a: Tower) => a.towerId);
        setActiveTowerId(ids[0]);
        await refreshFloors(ids);
      }
    })();
  }, [currentDigitalTwinId, refreshtowers]);

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

  // Reload floors when towers change
  useEffect(() => {
    if (towers.length > 0) {
      const ids = towers.map((a) => a.towerId);
      refreshFloors(ids);
    }
  }, [towers, refreshFloors]);

  // Create new Tower
  const handleCreateTower = async () => {
    if (!currentDigitalTwinId) {
      alert('Please select a digital twin first');
      return;
    }
    const name = newTowerName.trim();
    if (!name) {
      alert('Please enter an Tower name');
      return;
    }
    try {
      const response = await towerAPI.create({ name, digitalTwinId: currentDigitalTwinId });
      setNewTowerName('');
      await refreshtowers();
      setActiveTowerId(response.data.towerId);
    } catch (error: any) {
      console.error('Failed to create Tower', error);
      alert(error.response?.data?.error || 'Failed to create Tower');
    }
  };

  // Delete Tower
  const handleDeleteTower = async (TowerId: number) => {
    const Tower = towers.find((a) => a.towerId === TowerId);
    if (!confirm(`Delete Tower "${Tower?.name}"? This will delete all floors and pods.`)) return;
    try {
      await towerAPI.delete(TowerId);
      if (activeTowerId === TowerId) {
        setActiveTowerId(towers.find((a) => a.towerId !== TowerId)?.towerId ?? null);
      }
      await refreshtowers();
    } catch (error) {
      console.error('Failed to delete Tower', error);
      alert('Failed to delete Tower');
    }
  };

  // Rename Tower
  const handleRenameTower = async (TowerId: number, newName: string) => {
    try {
      await towerAPI.update(TowerId, { name: newName });
      await refreshtowers();
    } catch (error: any) {
      console.error('Failed to rename Tower', error);
      alert(error.response?.data?.error || 'Failed to rename Tower');
    }
  };

  const notifyAssignmentsChanged = () => {
    setAssignmentsVersion((v) => v + 1);
    // Refresh floors to get updated assignment data
    if (towers.length > 0) {
      refreshFloors(towers.map((a) => a.towerId));
    }
  };

  const notifyEntitiesChanged = () => {
    setEntityVersion((v) => v + 1);
  };

  const handleFloorsChanged = () => {
    if (towers.length > 0) {
      refreshFloors(towers.map((a) => a.towerId));
    }
    refreshtowers(); // Update floor counts
  };

  const handlePodHighlight = (podId: number) => {
    setSelectedPodId(podId);
  };

  const handlePodDetailsOpen = (podId: number) => {
    setSelectedPodId(podId);
    setShowPodDetails(true);
  };

  const handleProcessPod = useCallback((podId: number) => {
    setProcessRequestPodId(podId);
    setProcessRequestNonce((n) => n + 1);
  }, []);

  // Find Tower and floor for selected pod
  const selectedPodInfo = useMemo(() => {
    if (!selectedPodId) {
      return { TowerName: undefined, floorName: undefined, podName: undefined };
    }

    for (const floor of floors) {
      for (const ring of floor.rings || []) {
        for (const pod of ring.pods || []) {
          if (pod.podId === selectedPodId) {
            const Tower = towers.find((a) => a.towerId === floor.towerId);
            return {
              TowerName: Tower?.name,
              floorName: floor.name,
              podName: pod.name || '',
            };
          }
        }
      }
    }

    return { TowerName: undefined, floorName: undefined, podName: undefined };
  }, [selectedPodId, floors, towers]);

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

  // Compute virtual camera navigation location
  const navLocation = useMemo(() => {
    if (!podNavState?.active) return null;
    
    const onRoad = podNavState.currentRoad !== null;
    if (onRoad) {
      return { active: true, onRoad: true };
    }
    
    const towerId = podNavState.inTowerId;
    if (towerId === null) {
      return { active: true };
    }
    
    const tower = towers.find(t => t.towerId === towerId);
    const towerName = tower?.name || `Tower ${towerId}`;
    
    // Find floor by index
    const towerFloors = floors.filter(f => f.towerId === towerId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const floor = towerFloors[podNavState.currentFloor];
    const floorName = floor?.name || `Floor ${podNavState.currentFloor + 1}`;
    
    return { active: true, towerName, floorName };
  }, [podNavState, towers, floors]);

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

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !centerContainerRef.current) return;
      
      const rect = centerContainerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientY - rect.top) / rect.height) * 100;
      const clampedPercent = Math.max(20, Math.min(80, newPercent));
      setCenterSplitPercent(clampedPercent);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
              Digital Twin Studio
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

        {/* Digital Twin Selector */}
        <DigitalTwinSelector
          currentDigitalTwinId={currentDigitalTwinId}
          onDigitalTwinChange={setCurrentDigitalTwinId}
        />

        {/* Tower controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="New Tower name"
            value={newTowerName}
            onChange={(e) => setNewTowerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTower()}
            style={{ 
              padding: '6px 10px', 
              width: '180px',
            }}
          />
          <button 
            onClick={handleCreateTower} 
            style={{ 
              padding: '6px 14px',
              backgroundColor: 'var(--accent)',
              border: '1px solid var(--accent)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            + Tower
          </button>
        </div>
      </header>

      <MyPresenceBar
        digitalTwinId={currentDigitalTwinId}
        selectedEntityId={myPersonEntityId}
        onSelectEntity={setMyPersonEntityId}
        podName={myPresenceInfo.podName}
        refreshKey={entityVersion}
        navLocation={navLocation}
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
            towers={towers}
            floors={floors}
            activeTowerId={activeTowerId}
            selectedFloorId={selectedFloorId}
            onSelectTower={setActiveTowerId}
            onSelectFloor={setSelectedFloorId}
            onDeleteTower={handleDeleteTower}
            onRenameTower={handleRenameTower}
            onFloorsChanged={handleFloorsChanged}
            onTowersChanged={refreshtowers}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} ref={centerContainerRef}>
          <div
            style={{
              height: `${centerSplitPercent}%`,
              minHeight: 0,
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LayoutView
              towers={towers}
              floors={floors}
              activeTowerId={activeTowerId}
              selectedFloorId={selectedFloorId}
              selectedPodId={selectedPodId}
              onPodSelect={handlePodDetailsOpen}
              assignmentsVersion={assignmentsVersion}
              onLayoutChanged={handleFloorsChanged}
              presencePodId={myPresenceInfo.podId}
              processRequest={
                processRequestPodId
                  ? {
                      podId: processRequestPodId,
                      nonce: processRequestNonce,
                    }
                  : null
              }
              onRequestProcessSelected={() => {
                if (selectedPodId) {
                  handleProcessPod(selectedPodId);
                }
              }}
              onNavigationStateChange={(state, handleAction) => {
                setPodNavState(state);
                podNavActionRef.current = handleAction;
              }}
            />
          </div>
          {podNavState?.active ? (
            /* HUD panel when navigation is active */
            <div
              style={{
                height: `${100 - centerSplitPercent}%`,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-surface)',
                borderTop: '1px solid var(--border)',
              }}
            >
              <PodNavigationHUD state={podNavState} onAction={(action) => podNavActionRef.current?.(action)} />
            </div>
          ) : (
            <>
              <div
                style={{
                  height: '4px',
                  backgroundColor: 'var(--border)',
                  cursor: 'ns-resize',
                  position: 'relative',
                  zIndex: 10,
                }}
                onMouseDown={handleSplitterMouseDown}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '40px',
                    height: '3px',
                    backgroundColor: 'var(--text-muted)',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <div
                style={{
                  height: `${100 - centerSplitPercent}%`,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <ContextPanel
                  digitalTwinId={currentDigitalTwinId}
                  towers={towers}
                  floors={floors}
                  selectedFloorId={selectedFloorId}
                  selectedPodId={showPodDetails ? selectedPodId : null}
                  selectedPodInfo={selectedPodInfo}
                  onLayoutChanged={handleFloorsChanged}
                  onPodHighlight={handlePodHighlight}
                  onPodDetailsOpen={handlePodDetailsOpen}
                  onAssignmentsChanged={notifyAssignmentsChanged}
                  onPodUpdated={handleFloorsChanged}
                  onClearPodSelection={() => { setSelectedPodId(null); setShowPodDetails(false); }}
                  onProcessPod={handleProcessPod}
                  entityRefreshKey={entityVersion}
                />
              </div>
            </>
          )}
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
          <EntityLibrary variant="sidebar" digitalTwinId={currentDigitalTwinId} onEntitiesChanged={notifyEntitiesChanged} />
        </div>
      </div>
    </div>
  );
}

export default App;

