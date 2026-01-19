/**
 * Pod Navigation HUD
 * 
 * Heads-up display overlay showing navigation state:
 * - Compass rose with current heading
 * - Speed gauge (6 segments)
 * - Vertical state indicator
 * - Camera position/height
 * - Floor indicator when in tower
 */

import React from 'react';
import { NavigationState, SPEED_VALUES, SpeedLevel, NavAction } from './PodNavigationTypes';

interface PodNavigationHUDProps {
  state: NavigationState;
  onAction: (action: NavAction) => void;
}

export const PodNavigationHUD: React.FC<PodNavigationHUDProps> = ({ state, onAction }) => {
  const podAngle = (state.podRotation / 6) * 360;
  const totalHeading = (podAngle + state.cameraPan) % 360;
  
  const getDirectionLabel = (angle: number): string => {
    const normalized = ((angle % 360) + 360) % 360;
    if (normalized < 22.5 || normalized >= 337.5) return 'N';
    if (normalized < 67.5) return 'NE';
    if (normalized < 112.5) return 'E';
    if (normalized < 157.5) return 'SE';
    if (normalized < 202.5) return 'S';
    if (normalized < 247.5) return 'SW';
    if (normalized < 292.5) return 'W';
    return 'NW';
  };

  const getVerticalIcon = (): string => {
    switch (state.verticalMode) {
      case 'ascending': return '⬆️';
      case 'descending': return '⬇️';
      case 'ejected': return '🚀';
      default: return '🛤️';
    }
  };
  
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Compass */}
        <div style={styles.section}>
          <div style={styles.compass}>
            <div 
              style={{ 
                ...styles.compassNeedle, 
                transform: `rotate(${totalHeading}deg)` 
              }}
            >
              ▲
            </div>
            <div style={styles.compassLabel}>
              {getDirectionLabel(totalHeading)}
            </div>
          </div>
          <div style={styles.label}>{Math.round(totalHeading)}°</div>
        </div>

        {/* Speed Gauge */}
        <div style={styles.section}>
          <div style={styles.speedGauge}>
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                style={{
                  ...styles.speedSegment,
                  backgroundColor: level <= state.speed ? '#00ff88' : '#333',
                  opacity: level <= state.speed ? 1 : 0.3,
                }}
              />
            ))}
          </div>
          <div style={styles.label}>
            {SPEED_VALUES[state.speed as SpeedLevel]} u/s
          </div>
        </div>

        {/* Vertical State */}
        <div style={styles.section}>
          <div style={styles.verticalIndicator}>
            {getVerticalIcon()}
          </div>
          <div style={styles.label}>
            {state.inTowerId !== null ? `F${state.currentFloor + 1}` : 'Road'}
          </div>
        </div>

        {/* Camera Position */}
        <div style={styles.section}>
          <div style={styles.cameraGrid}>
            {/* Height indicator */}
            <div style={styles.heightBar}>
              {[4, 3, 2, 1, 0].map((h) => (
                <div
                  key={h}
                  style={{
                    ...styles.heightSegment,
                    backgroundColor: h === state.cameraHeight ? '#ffcc00' : '#333',
                  }}
                />
              ))}
            </div>
            {/* Slot indicator - hexagonal arrangement */}
            <div style={styles.slotHex}>
              <div 
                style={{
                  ...styles.slotDot,
                  ...(state.cameraSlot === 0 ? styles.slotActive : {}),
                }}
                onClick={() => onAction('camera-slot-1')}
              />
              {[1, 2, 3, 4, 5, 6].map((slot) => {
                const angle = ((slot - 1) / 6) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * 12;
                const y = Math.sin(angle) * 12;
                const slotActions: Record<number, NavAction> = {
                  1: 'camera-slot-2',
                  2: 'camera-slot-3',
                  3: 'camera-slot-4',
                  4: 'camera-slot-5',
                  5: 'camera-slot-6',
                  6: 'camera-slot-7',
                };
                return (
                  <div
                    key={slot}
                    style={{
                      ...styles.slotDot,
                      ...(state.cameraSlot === slot ? styles.slotActive : {}),
                      position: 'absolute',
                      left: `calc(50% + ${x}px - 4px)`,
                      top: `calc(50% + ${y}px - 4px)`,
                    }}
                    onClick={() => onAction(slotActions[slot])}
                  />
                );
              })}
            </div>
          </div>
          <div style={styles.label}>Cam</div>
        </div>

        {/* Tilt indicator */}
        <div style={styles.section}>
          <div style={styles.tiltIndicator}>
            <div 
              style={{
                ...styles.tiltNeedle,
                transform: `rotate(${state.cameraTilt - 90}deg)`,
              }}
            />
          </div>
          <div style={styles.label}>{state.cameraTilt - 90}°</div>
        </div>
      </div>

      {/* Control hints */}
      <div style={styles.hints}>
        <span>A/D: Rotate</span>
        <span>W/S: Speed</span>
        <span>Q/E: Pan</span>
        <span>↑↓: Tilt</span>
        <span>R/F: Floors</span>
        <span>1-7: Cam Slot</span>
        <span>Z/X: Height</span>
        <span>0: Reset</span>
        <span>N/Esc: Exit</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'auto',
  },
  container: {
    display: 'flex',
    gap: '16px',
    padding: '12px 20px',
    background: 'rgba(0, 0, 0, 0.75)',
    borderRadius: '12px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '12px',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  label: {
    fontSize: '10px',
    color: '#aaa',
    textTransform: 'uppercase',
  },
  compass: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '2px solid #555',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassNeedle: {
    position: 'absolute',
    top: '2px',
    fontSize: '14px',
    color: '#ff4444',
    transition: 'transform 0.1s ease-out',
  },
  compassLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
  },
  speedGauge: {
    display: 'flex',
    gap: '2px',
    height: '40px',
    alignItems: 'flex-end',
  },
  speedSegment: {
    width: '6px',
    height: '100%',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  verticalIndicator: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  cameraGrid: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  heightBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  heightSegment: {
    width: '8px',
    height: '6px',
    borderRadius: '1px',
    cursor: 'pointer',
  },
  slotHex: {
    width: '36px',
    height: '36px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#555',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  slotActive: {
    backgroundColor: '#ffcc00',
    boxShadow: '0 0 6px #ffcc00',
  },
  tiltIndicator: {
    width: '40px',
    height: '20px',
    borderRadius: '20px 20px 0 0',
    border: '2px solid #555',
    borderBottom: 'none',
    position: 'relative',
    overflow: 'hidden',
  },
  tiltNeedle: {
    position: 'absolute',
    bottom: '0',
    left: '50%',
    width: '2px',
    height: '16px',
    backgroundColor: '#00ff88',
    transformOrigin: 'bottom center',
    marginLeft: '-1px',
    transition: 'transform 0.1s ease-out',
  },
  hints: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
    fontSize: '9px',
    color: '#888',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
};

export default PodNavigationHUD;
