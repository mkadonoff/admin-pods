import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000'
});

// Types
export interface Assembly {
  assemblyId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { floors: number };
}

export interface Floor {
  floorId: number;
  name: string;
  orderIndex: number;
  assemblyId: number;
  assembly?: { assemblyId: number; name: string };
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
}

export interface PodAssignment {
  assignmentId: number;
  podId: number;
  entityId: number;
  roleTag: string | null;
  createdAt: string;
  entity?: Entity;
}

// Assemblies
export const assemblyAPI = {
  list: () => API.get<Assembly[]>('/assemblies'),
  get: (id: number) => API.get<Assembly & { floors: Floor[] }>(`/assemblies/${id}`),
  create: (name: string) => API.post<Assembly>('/assemblies', { name }),
  update: (id: number, name: string) => API.patch<Assembly>(`/assemblies/${id}`, { name }),
  delete: (id: number) => API.delete(`/assemblies/${id}`),
};

// Floors
export const floorAPI = {
  list: (assemblyIds?: number[]) => {
    const params = assemblyIds?.length ? { assemblyIds: assemblyIds.join(',') } : {};
    return API.get<Floor[]>('/floors', { params });
  },
  create: (data: { name: string; orderIndex?: number; assemblyId: number }) =>
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
  list: (type?: string, q?: string) => API.get<Entity[]>('/entities', { params: { type, q } }),
  create: (data: { entityType: string; displayName: string; externalSystemId?: string }) =>
    API.post<Entity>('/entities', data),
  update: (id: number, data: Partial<{ displayName: string; externalSystemId: string }>) =>
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
