import { useEffect, useMemo, useState } from 'react';
import './App.css';
import arpogeLogo from './assets/arpoge-logo.png';
import { FloorManager } from './components/FloorManager';
import { LayoutView } from './components/LayoutView';
import { PodDetailDrawer } from './components/PodDetailDrawer';
import { EntityLibrary } from './components/EntityLibrary';
import { floorAPI } from './api';

interface Floor {
  floorId: number;
  name: string;
  orderIndex: number;
}

interface LayoutPod {
  podId: number;
  ringId: number;
  slotIndex: number;
}

interface LayoutRing {
  ringId: number;
  radiusIndex: number;
}

function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedPod, setSelectedPod] = useState<number | null>(null);
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [layoutPods, setLayoutPods] = useState<LayoutPod[]>([]);
  const [layoutRings, setLayoutRings] = useState<LayoutRing[]>([]);

  const floorsSorted = useMemo(() => {
    return [...floors].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [floors]);

  const selectedFloorIndex = useMemo(() => {
    if (!selectedFloor) return 0;
    const idx = floorsSorted.findIndex((f) => f.floorId === selectedFloor);
    return idx >= 0 ? idx : 0;
  }, [floorsSorted, selectedFloor]);

  const refreshFloors = async () => {
    try {
      const response = await floorAPI.list();
      setFloors(response.data);
    } catch (error) {
      console.error('Failed to load floors', error);
    }
  };

  useEffect(() => {
    refreshFloors();
  }, []);

  useEffect(() => {
    // When floor changes, clear selected pod (pod belongs to previous floor).
    setSelectedPod(null);
  }, [selectedFloor]);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();

      // Ensure we have an up-to-date floor list for navigation.
      if (floorsSorted.length === 0) {
        await refreshFloors();
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const list = floorsSorted.length ? floorsSorted : [...floors].sort((a, b) => a.orderIndex - b.orderIndex);
        if (list.length === 0) return;

        const currentIndex = selectedFloor ? list.findIndex((f) => f.floorId === selectedFloor) : -1;
        const nextIndex = event.key === 'ArrowUp' ? Math.max(0, currentIndex - 1) : Math.min(list.length - 1, currentIndex + 1);
        const nextFloor = list[nextIndex] ?? list[0];
        setSelectedFloor(nextFloor.floorId);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!selectedFloor) return;
        if (layoutPods.length === 0) return;

        const dir = event.key === 'ArrowLeft' ? -1 : 1;

        const ringById = new Map<number, number>(layoutRings.map((r) => [r.ringId, r.radiusIndex]));

        const sortPods = (pods: LayoutPod[]) => {
          return [...pods].sort((a, b) => {
            const ra = ringById.get(a.ringId) ?? 999;
            const rb = ringById.get(b.ringId) ?? 999;
            if (ra !== rb) return ra - rb;
            return a.slotIndex - b.slotIndex;
          });
        };

        if (!selectedPod) {
          const first = sortPods(layoutPods)[0];
          if (first) setSelectedPod(first.podId);
          return;
        }

        const currentPod = layoutPods.find((p) => p.podId === selectedPod);
        if (!currentPod) {
          const first = sortPods(layoutPods)[0];
          if (first) setSelectedPod(first.podId);
          return;
        }

        const sameRingPods = layoutPods
          .filter((p) => p.ringId === currentPod.ringId)
          .sort((a, b) => a.slotIndex - b.slotIndex);

        if (sameRingPods.length === 0) return;

        const idx = sameRingPods.findIndex((p) => p.podId === currentPod.podId);
        const nextIdx = (idx + dir + sameRingPods.length) % sameRingPods.length;
        setSelectedPod(sameRingPods[nextIdx].podId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [floors, floorsSorted, layoutPods, layoutRings, selectedFloor, selectedPod]);

  const notifyAssignmentsChanged = () => {
    setAssignmentsVersion((v) => v + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={arpogeLogo} alt="Arpoge" style={{ height: '28px', width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Entity Admin Console</div>
            <div style={{ fontSize: '12px', color: '#666' }}>v0.1</div>
          </div>
        </div>
        <div />
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <FloorManager onFloorSelect={setSelectedFloor} />
        {selectedFloor && (
          <>
            <LayoutView
              floorId={selectedFloor}
              onPodSelect={setSelectedPod}
              assignmentsVersion={assignmentsVersion}
              floorIndex={selectedFloorIndex}
              onLayoutData={(pods, rings) => {
                setLayoutPods(pods);
                setLayoutRings(rings);
              }}
            />
            <EntityLibrary />
          </>
        )}
        <PodDetailDrawer
          podId={selectedPod}
          onClose={() => setSelectedPod(null)}
          onAssignmentsChanged={notifyAssignmentsChanged}
        />
      </div>
    </div>
  );
}

export default App;
