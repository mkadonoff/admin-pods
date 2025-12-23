import { useState } from 'react';
import './App.css';
import arpogeLogo from './assets/arpoge-logo.png';
import { FloorManager } from './components/FloorManager';
import { LayoutView } from './components/LayoutView';
import { PodDetailDrawer } from './components/PodDetailDrawer';
import { EntityLibrary } from './components/EntityLibrary';

function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedPod, setSelectedPod] = useState<number | null>(null);
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);

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
