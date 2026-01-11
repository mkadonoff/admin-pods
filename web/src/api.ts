import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const API = axios.create({
  baseURL: API_BASE_URL,
});

export interface ApiHealth {
  status: 'ok' | 'error';
  database: string;
  gitCommit: string | null;
  serverTime: string;
  environment: string;
  error?: string;
}

// Types
export interface DigitalTwin {
  digitalTwinId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    towers: number;
    entities: number;
  };
}

export interface Tower {
  towerId: number;
  name: string;
  digitalTwinId: number;
  digitalTwin?: DigitalTwin;
  createdAt: string;
  updatedAt: string;
  _count?: { floors: number };
}

export interface Floor {
  floorId: number;
  name: string;
  orderIndex: number;
  towerId: number;
  tower?: { towerId: number; name: string };
  rings?: Ring[];
}

export interface Ring {
  ringId: number;
  floorId: number;
  name: string;
  radiusIndex: number;
  slots: number;
  pods?: Pod[];
}

export interface Pod {
  podId: number;
  floorId: number;
  ringId: number;
  slotIndex: number;
  name: string;
  podType: string;
  assignments?: PodAssignment[];
}

export interface Entity {
  entityId: number;
  entityType: string;
  displayName: string;
  externalSystemId: string | null;
  content?: string | null;
  digitalTwinId: number;
  digitalTwin?: DigitalTwin;
}

export interface PodAssignment {
  assignmentId: number;
  podId: number;
  entityId: number;
  roleTag: string | null;
  createdAt: string;
  entity?: Entity;
}

// Digital Twins
export const digitalTwinAPI = {
  list: () => API.get<DigitalTwin[]>('/digital-twins'),
  get: (id: number) => API.get<DigitalTwin & { towers: Tower[]; entities: Entity[] }>(`/digital-twins/${id}`),
  create: (data: { name: string; description?: string }) => API.post<DigitalTwin>('/digital-twins', data),
  update: (id: number, data: { name?: string; description?: string }) => API.patch<DigitalTwin>(`/digital-twins/${id}`, data),
  delete: (id: number) => API.delete(`/digital-twins/${id}`),
};

// Towers
export const towerAPI = {
  list: (digitalTwinId?: number) => {
    const params = digitalTwinId ? { digitalTwinId } : {};
    return API.get<Tower[]>('/towers', { params });
  },
  get: (id: number) => API.get<Tower & { floors: Floor[] }>(`/towers/${id}`),
  create: (data: { name: string; digitalTwinId: number }) => API.post<Tower>('/towers', data),
  update: (id: number, name: string) => API.patch<Tower>(`/towers/${id}`, { name }),
  delete: (id: number) => API.delete(`/towers/${id}`),
};

// Floors
export const floorAPI = {
  list: (towerIds?: number[]) => {
    const params = towerIds?.length ? { towerIds: towerIds.join(',') } : {};
    return API.get<Floor[]>('/floors', { params });
  },
  create: (data: { name: string; orderIndex?: number; towerId: number }) =>
    API.post<Floor>('/floors', data),
  update: (id: number, data: Partial<{ name: string; orderIndex: number }>) =>
    API.patch<Floor>(`/floors/${id}`, data),
  delete: (id: number) => API.delete(`/floors/${id}`),
};

// Rings
export const ringAPI = {
  listByFloor: (floorId: number) => API.get<Ring[]>(`/floors/${floorId}/rings`),
  create: (floorId: number, data: { name: string; radiusIndex: number; slots: number }) =>
    API.post<Ring>(`/floors/${floorId}/rings`, data),
  update: (id: number, data: Partial<{ name: string; radiusIndex: number }>) => API.patch<Ring>(`/rings/${id}`, data),
  delete: (id: number) => API.delete(`/rings/${id}`),
};

// Pods
export const podAPI = {
  listByFloor: (floorId: number) => API.get<Pod[]>(`/floors/${floorId}/pods`),
  update: (id: number, data: Partial<{ name: string; podType: string }>) =>
    API.patch<Pod>(`/pods/${id}`, data),
};

// Entities
export const entityAPI = {
  list: (digitalTwinId: number, type?: string, q?: string) => 
    API.get<Entity[]>('/entities', { params: { digitalTwinId, type, q } }),
  create: (data: { entityType: string; displayName: string; digitalTwinId: number; externalSystemId?: string; content?: string }) =>
    API.post<Entity>('/entities', data),
  update: (id: number, data: Partial<{ displayName: string; externalSystemId: string; content: string }>) =>
    API.patch<Entity>(`/entities/${id}`, data),
  delete: (id: number) => API.delete(`/entities/${id}`),
};

// Assignments
export const assignmentAPI = {
  listAll: () => API.get<PodAssignment[]>('/assignments'),
  listByPod: (podId: number) => API.get<PodAssignment[]>(`/pods/${podId}/assignments`),
  create: (podId: number, data: { entityId: number; roleTag?: string }) =>
    API.post<PodAssignment>(`/pods/${podId}/assignments`, data),
  delete: (id: number) => API.delete(`/assignments/${id}`),
};

export const healthAPI = {
  status: () => API.get<ApiHealth>('/health'),
};
