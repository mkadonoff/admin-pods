import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000'
});

// Floors
export const floorAPI = {
  list: () => API.get('/floors'),
  create: (data: { name: string; orderIndex: number }) => API.post('/floors', data),
  update: (id: number, data: Partial<{ name: string; orderIndex: number }>) => 
    API.patch(`/floors/${id}`, data),
  delete: (id: number) => API.delete(`/floors/${id}`),
};

// Rings
export const ringAPI = {
  listByFloor: (floorId: number) => API.get(`/floors/${floorId}/rings`),
  create: (floorId: number, data: { name: string; radiusIndex: number; slots: number }) =>
    API.post(`/floors/${floorId}/rings`, data),
  update: (id: number, data: Partial<{ name: string }>) => API.patch(`/rings/${id}`, data),
  delete: (id: number) => API.delete(`/rings/${id}`),
};

// Pods
export const podAPI = {
  listByFloor: (floorId: number) => API.get(`/floors/${floorId}/pods`),
  update: (id: number, data: Partial<{ name: string; podType: string }>) =>
    API.patch(`/pods/${id}`, data),
};

// Entities
export const entityAPI = {
  list: (type?: string, q?: string) => API.get('/entities', { params: { type, q } }),
  create: (data: { entityType: string; displayName: string; externalSystemId?: string }) =>
    API.post('/entities', data),
  update: (id: number, data: Partial<{ displayName: string; externalSystemId: string }>) =>
    API.patch(`/entities/${id}`, data),
  delete: (id: number) => API.delete(`/entities/${id}`),
};

// Assignments
export const assignmentAPI = {
  listByPod: (podId: number) => API.get(`/pods/${podId}/assignments`),
  create: (podId: number, data: { entityId: number; roleTag?: string }) =>
    API.post(`/pods/${podId}/assignments`, data),
  delete: (id: number) => API.delete(`/assignments/${id}`),
};
