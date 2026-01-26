/**
 * Navigation Types
 * 
 * View presets and camera control types for the layout view.
 */

export type Vec3 = [number, number, number];

/** View preset identifiers */
export type ViewPreset = 'first-person' | 'birds-eye' | 'tower-focus' | 'floor-slice';

/** View preset configuration */
export interface ViewPresetConfig {
  id: ViewPreset;
  name: string;
  key: string; // Keyboard shortcut
  getCamera: (context: ViewContext) => CameraTarget;
}

/** Context available for computing view positions */
export interface ViewContext {
  presencePodPosition: Vec3 | null;
  presenceTowerId: number | null;
  activeTowerPosition: { x: number; z: number } | null;
  sceneBounds: { centerX: number; centerZ: number; extent: number; maxFloors: number };
}

/** Camera target for animation */
export interface CameraTarget {
  position: Vec3;
  lookAt: Vec3;
}

/** Key bindings for view presets */
export const VIEW_PRESET_KEYS: Record<string, ViewPreset> = {
  '1': 'first-person',
  '2': 'birds-eye',
  '3': 'tower-focus',
  '4': 'floor-slice',
};

/** Utility: Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Utility: Lerp Vec3 */
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
