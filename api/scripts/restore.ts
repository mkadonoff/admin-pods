import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function restore() {
  try {
    // Read the backup file
    const backupPath = path.join(__dirname, '../../backups/backup_transformed.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    console.log('Cleaning up existing data...');
    await prisma.podAssignment.deleteMany({});
    await prisma.pod.deleteMany({});
    await prisma.ring.deleteMany({});
    await prisma.floor.deleteMany({});
    await prisma.tower.deleteMany({});
    await prisma.entity.deleteMany({});
    console.log('Existing data cleared');

    console.log('\nCreating default digital twin...');
    let digitalTwin = await prisma.digitalTwin.findFirst({
      where: { name: 'Main Workspace' },
    });
    
    if (!digitalTwin) {
      digitalTwin = await prisma.digitalTwin.create({
        data: {
          name: 'Main Workspace',
          description: 'Primary digital twin workspace',
        },
      });
    }
    console.log(`Using digital twin: ${digitalTwin.name} (ID: ${digitalTwin.digitalTwinId})`);

    // Restore entities
    console.log(`\nRestoring ${backupData.entities.length} entities...`);
    const entityIdMap = new Map<string, number>();
    for (const entity of backupData.entities) {
      const newEntity = await prisma.entity.create({
        data: {
          entityType: entity.type,
          displayName: entity.name,
          externalSystemId: entity.externalSystemId,
          content: entity.content,
          digitalTwinId: digitalTwin.digitalTwinId,
        },
      });
      entityIdMap.set(entity.id, newEntity.entityId);
    }
    console.log(`Restored ${entityIdMap.size} entities`);

    // Restore towers
    console.log(`\nRestoring ${backupData.towers.length} towers...`);
    const towerIdMap = new Map<string, number>();
    for (const tower of backupData.towers) {
      const newTower = await prisma.tower.create({
        data: {
          name: tower.name,
          digitalTwinId: digitalTwin.digitalTwinId,
        },
      });
      towerIdMap.set(tower.id, newTower.towerId);
    }
    console.log(`Restored ${towerIdMap.size} towers`);

    // Restore floors
    console.log(`\nRestoring ${backupData.floors.length} floors...`);
    const floorIdMap = new Map<string, number>();
    for (const floor of backupData.floors) {
      const newFloor = await prisma.floor.create({
        data: {
          name: floor.name,
          orderIndex: floor.orderIndex,
          towerId: towerIdMap.get(floor.towerId)!,
        },
      });
      floorIdMap.set(floor.id, newFloor.floorId);
    }
    console.log(`Restored ${floorIdMap.size} floors`);

    // Restore rings
    console.log(`\nRestoring ${backupData.rings.length} rings...`);
    const ringIdMap = new Map<string, number>();
    for (const ring of backupData.rings) {
      const newRing = await prisma.ring.create({
        data: {
          name: ring.name,
          radiusIndex: ring.radiusIndex,
          slots: ring.slots,
          floorId: floorIdMap.get(ring.floorId)!,
        },
      });
      ringIdMap.set(ring.id, newRing.ringId);
    }
    console.log(`Restored ${ringIdMap.size} rings`);

    // Restore pods
    console.log(`\nRestoring ${backupData.pods.length} pods...`);
    const podIdMap = new Map<string, number>();
    
    // Create a map of ringId to floorId from the backup data
    const ringToFloorMap = new Map<string, string>();
    for (const ring of backupData.rings) {
      ringToFloorMap.set(ring.id, ring.floorId);
    }
    
    for (const pod of backupData.pods) {
      // Get the ring's floorId
      const ringBackupFloorId = ringToFloorMap.get(pod.ringId);
      if (!ringBackupFloorId) {
        console.warn(`Warning: Could not find floor for pod ${pod.name} with ringId ${pod.ringId}`);
        continue;
      }
      
      const newPod = await prisma.pod.create({
        data: {
          name: pod.name,
          podType: pod.podType,
          slotIndex: pod.slotIndex,
          floorId: floorIdMap.get(ringBackupFloorId)!,
          ringId: ringIdMap.get(pod.ringId)!,
        },
      });
      podIdMap.set(pod.id, newPod.podId);
    }
    console.log(`Restored ${podIdMap.size} pods`);

    // Restore assignments
    console.log(`\nRestoring ${backupData.assignments.length} assignments...`);
    for (const assignment of backupData.assignments) {
      await prisma.podAssignment.create({
        data: {
          podId: podIdMap.get(assignment.podId)!,
          entityId: entityIdMap.get(assignment.entityId)!,
          roleTag: assignment.roleTag,
        },
      });
    }
    console.log(`Restored ${backupData.assignments.length} assignments`);

    console.log('\n✅ Restore complete!');
    console.log(`\nSummary:`);
    console.log(`- Digital Twin: ${digitalTwin.name}`);
    console.log(`- Towers: ${towerIdMap.size}`);
    console.log(`- Floors: ${floorIdMap.size}`);
    console.log(`- Rings: ${ringIdMap.size}`);
    console.log(`- Pods: ${podIdMap.size}`);
    console.log(`- Entities: ${entityIdMap.size}`);
    console.log(`- Assignments: ${backupData.assignments.length}`);

  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restore();
