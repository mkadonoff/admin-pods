import React, { useState } from 'react';
import './App.css';
import { FloorManager } from './components/FloorManager';
import { LayoutView } from './components/LayoutView';
import { PodDetailDrawer } from './components/PodDetailDrawer';
import { EntityLibrary } from './components/EntityLibrary';

function App() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedPod, setSelectedPod] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <FloorManager onFloorSelect={setSelectedFloor} />
      {selectedFloor && (
        <>
          <LayoutView floorId={selectedFloor} onPodSelect={setSelectedPod} />
          <EntityLibrary />
        </>
      )}
      <PodDetailDrawer podId={selectedPod} onClose={() => setSelectedPod(null)} />
    </div>
  );
}

export default App;
