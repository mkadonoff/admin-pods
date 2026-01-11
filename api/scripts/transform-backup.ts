import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

interface OldBackup {
  assemblies: Array<{
    assemblyId: number;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>;
  floors: Array<{
    floorId: number;
    name: string;
    orderIndex: number;
    assemblyId: number;
  }>;
  rings: Array<{
    ringId: number;
    floorId: number;
    name: string;
    radiusIndex: number;
    slots: number;
  }>;
  pods: Array<{
    podId: number;
    floorId: number;
    ringId: number;
    slotIndex: number;
    name: string;
    podType: string;
  }>;
  entities: Array<{
    entityId: number;
    entityType: string;
    displayName: string;
    externalSystemId: string | null;
    content: string | null;
  }>;
  assignments: Array<{
    assignmentId: number;
    podId: number;
    entityId: number;
    roleTag: string | null;
    createdAt: string;
  }>;
  timestamp: string;
}

async function transformBackup() {
  const inputFile = path.join(process.cwd(), '..', 'backups', 'backup_2026-01-11T16-50-55-169Z.json');
  const outputFile = path.join(process.cwd(), '..', 'backups', 'backup_transformed.json');

  console.log('Reading backup file...');
  const content = await fs.readFile(inputFile, 'utf-8');
  const oldData: OldBackup = JSON.parse(content);

  console.log('Creating ID mappings...');
  const towerIdMap = new Map<number, string>();
  const floorIdMap = new Map<number, string>();
  const ringIdMap = new Map<number, string>();
  const podIdMap = new Map<number, string>();
  const entityIdMap = new Map<number, string>();

  // Transform towers (assemblies)
  console.log('Transforming assemblies to towers...');
  const towers = oldData.assemblies.map(assembly => {
    const id = randomUUID();
    towerIdMap.set(assembly.assemblyId, id);
    return {
      id,
      name: assembly.name,
      createdAt: assembly.createdAt,
      updatedAt: assembly.updatedAt,
    };
  });

  // Transform floors with towerId
  console.log('Transforming floors...');
  const floors = oldData.floors.map(floor => {
    const id = randomUUID();
    floorIdMap.set(floor.floorId, id);
    const towerId = towerIdMap.get(floor.assemblyId);
    if (!towerId) {
      throw new Error(`Tower not found for floor ${floor.floorId} (assemblyId: ${floor.assemblyId})`);
    }
    return {
      id,
      name: floor.name,
      towerId,
      orderIndex: floor.orderIndex,
    };
  });

  // Transform rings
  console.log('Transforming rings...');
  const rings = oldData.rings.map(ring => {
    const id = randomUUID();
    ringIdMap.set(ring.ringId, id);
    const floorId = floorIdMap.get(ring.floorId);
    if (!floorId) {
      throw new Error(`Floor not found for ring ${ring.ringId}`);
    }
    return {
      id,
      name: ring.name,
      floorId,
      radiusIndex: ring.radiusIndex,
      slots: ring.slots,
    };
  });

  // Transform pods
  console.log('Transforming pods...');
  const pods = oldData.pods.map(pod => {
    const id = randomUUID();
    podIdMap.set(pod.podId, id);
    const ringId = ringIdMap.get(pod.ringId);
    if (!ringId) {
      throw new Error(`Ring not found for pod ${pod.podId}`);
    }
    return {
      id,
      name: pod.name,
      ringId,
      slotIndex: pod.slotIndex,
      podType: pod.podType,
    };
  });

  // Transform entities
  console.log('Transforming entities...');
  const entities = oldData.entities.map(entity => {
    const id = randomUUID();
    entityIdMap.set(entity.entityId, id);
    return {
      id,
      name: entity.displayName,
      type: entity.entityType,
      externalSystemId: entity.externalSystemId,
      content: entity.content,
    };
  });

  // Transform assignments
  console.log('Transforming assignments...');
  const assignments = oldData.assignments.map(assignment => {
    const podId = podIdMap.get(assignment.podId);
    const entityId = entityIdMap.get(assignment.entityId);
    if (!podId || !entityId) {
      throw new Error(`Pod or entity not found for assignment ${assignment.assignmentId}`);
    }
    return {
      podId,
      entityId,
      roleTag: assignment.roleTag,
      createdAt: assignment.createdAt,
    };
  });

  // Write new backup
  const newData = {
    towers,
    floors,
    rings,
    pods,
    entities,
    assignments,
    timestamp: new Date().toISOString(),
  };

  await fs.writeFile(outputFile, JSON.stringify(newData, null, 2));
  console.log('\n✅ Transformed backup saved to', outputFile);
  console.log(`   Towers: ${towers.length}`);
  console.log(`   Floors: ${floors.length} (linked to towers)`);
  console.log(`   Rings: ${rings.length}`);
  console.log(`   Pods: ${pods.length}`);
  console.log(`   Entities: ${entities.length}`);
  console.log(`   Assignments: ${assignments.length}`);
}

transformBackup().catch(error => {
  console.error('Transformation failed:', error);
  process.exit(1);
});
