/// <reference types="node" />
/**
 * Generate Customer Floors Script (Idempotent)
 * 
 * Creates a tower with floors/rings/pods for Customer entities.
 * - Only assigns customers that don't already have a pod assignment
 * - Fills empty pods in existing floors before creating new ones
 * - Safe to run multiple times
 * 
 * Ring configuration (doubling pattern):
 * - Ring 0 (center): 1 pod
 * - Ring 1: 6 pods
 * - Ring 2: 12 pods
 * - Ring 3: 24 pods
 * - Ring 4: 48 pods
 * - Ring 5: 96 pods
 * - Ring 6: 192 pods
 * Total: 379 pods per floor
 * 
 * Run with: npx ts-node scripts/generate-customer-floors.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DIGITAL_TWIN_NAME = 'RPG Squarefoot Solutions';
const TOWER_NAME = 'Customers';

// Ring configuration: radiusIndex -> slot count
const RING_CONFIG = [
  { radiusIndex: 0, slots: 1 },   // Center pod
  { radiusIndex: 1, slots: 6 },
  { radiusIndex: 2, slots: 12 },
  { radiusIndex: 3, slots: 24 },
  { radiusIndex: 4, slots: 48 },
  { radiusIndex: 5, slots: 96 },
  { radiusIndex: 6, slots: 192 },
];

const PODS_PER_FLOOR = RING_CONFIG.reduce((sum, r) => sum + r.slots, 0); // 379

async function main() {
  console.log('='.repeat(60));
  console.log('Customer Floor Generator (Idempotent)');
  console.log('='.repeat(60));
  console.log();

  // 1. Get digital twin
  const digitalTwin = await prisma.digitalTwin.findUnique({
    where: { name: DIGITAL_TWIN_NAME },
  });

  if (!digitalTwin) {
    console.error(`Digital twin "${DIGITAL_TWIN_NAME}" not found!`);
    process.exit(1);
  }

  console.log(`Digital Twin: ${digitalTwin.name} (ID: ${digitalTwin.digitalTwinId})`);

  // 2. Get all Customer entities
  const allCustomers = await prisma.entity.findMany({
    where: {
      digitalTwinId: digitalTwin.digitalTwinId,
      entityType: 'Customer',
    },
    orderBy: { displayName: 'asc' },
  });

  console.log(`Total customers: ${allCustomers.length}`);

  // 3. Get customers that already have assignments
  const assignedEntityIds = new Set(
    (await prisma.podAssignment.findMany({
      where: {
        entityId: { in: allCustomers.map(c => c.entityId) },
      },
      select: { entityId: true },
    })).map(a => a.entityId)
  );

  const unassignedCustomers = allCustomers.filter(c => !assignedEntityIds.has(c.entityId));
  console.log(`Already assigned: ${assignedEntityIds.size}`);
  console.log(`Unassigned customers to process: ${unassignedCustomers.length}`);

  if (unassignedCustomers.length === 0) {
    console.log('\nNo unassigned customers. Nothing to do!');
    return;
  }

  // 4. Get or create the Customers tower
  let tower = await prisma.tower.findFirst({
    where: {
      digitalTwinId: digitalTwin.digitalTwinId,
      name: TOWER_NAME,
    },
  });

  if (!tower) {
    tower = await prisma.tower.create({
      data: {
        name: TOWER_NAME,
        digitalTwinId: digitalTwin.digitalTwinId,
        orderIndex: 99, // Put at end
      },
    });
    console.log(`Created tower: ${TOWER_NAME} (ID: ${tower.towerId})`);
  } else {
    console.log(`Using existing tower: ${TOWER_NAME} (ID: ${tower.towerId})`);
  }

  // 5. Get existing floors with their pods
  const existingFloors = await prisma.floor.findMany({
    where: { towerId: tower.towerId },
    include: {
      rings: {
        include: {
          pods: {
            include: { assignments: true },
          },
        },
      },
    },
    orderBy: { orderIndex: 'asc' },
  });

  console.log(`Existing floors: ${existingFloors.length}`);

  // 6. Find empty pods in existing floors
  const emptyPods: { podId: number; floorId: number; name: string }[] = [];
  for (const floor of existingFloors) {
    for (const ring of floor.rings) {
      for (const pod of ring.pods) {
        if (pod.assignments.length === 0) {
          emptyPods.push({ podId: pod.podId, floorId: floor.floorId, name: pod.name });
        }
      }
    }
  }

  console.log(`Empty pods in existing floors: ${emptyPods.length}`);

  // 7. Assign customers to empty pods first
  let customerIndex = 0;
  let assignedCount = 0;

  for (const emptyPod of emptyPods) {
    if (customerIndex >= unassignedCustomers.length) break;

    const customer = unassignedCustomers[customerIndex];
    await prisma.podAssignment.create({
      data: {
        podId: emptyPod.podId,
        entityId: customer.entityId,
      },
    });

    // Update pod name to customer name
    await prisma.pod.update({
      where: { podId: emptyPod.podId },
      data: { name: customer.displayName },
    });

    customerIndex++;
    assignedCount++;
  }

  console.log(`Assigned to existing empty pods: ${assignedCount}`);

  // 8. Calculate how many new floors we need
  const remainingCustomers = unassignedCustomers.length - customerIndex;
  const floorsNeeded = Math.ceil(remainingCustomers / PODS_PER_FLOOR);

  console.log(`Remaining customers: ${remainingCustomers}`);
  console.log(`New floors needed: ${floorsNeeded}`);

  // 9. Create new floors and assign remaining customers
  const startFloorIndex = existingFloors.length;
  let newFloorsCreated = 0;
  let newAssignments = 0;

  for (let floorNum = 0; floorNum < floorsNeeded; floorNum++) {
    const floorIndex = startFloorIndex + floorNum;
    const floorName = `Customer Floor ${floorIndex + 1}`;

    // Create floor
    const floor = await prisma.floor.create({
      data: {
        name: floorName,
        orderIndex: floorIndex,
        towerId: tower.towerId,
      },
    });

    newFloorsCreated++;

    // Create rings and pods
    for (const ringConfig of RING_CONFIG) {
      const ringName = ringConfig.radiusIndex === 0 ? 'Center' : `Ring ${ringConfig.radiusIndex}`;

      const ring = await prisma.ring.create({
        data: {
          floorId: floor.floorId,
          name: ringName,
          radiusIndex: ringConfig.radiusIndex,
          slots: ringConfig.slots,
        },
      });

      // Create pods for this ring
      const podsData = [];
      const startSlot = ringConfig.radiusIndex === 0 ? -1 : 0;
      const endSlot = ringConfig.radiusIndex === 0 ? 0 : ringConfig.slots;

      for (let slotIndex = startSlot; slotIndex < endSlot; slotIndex++) {
        if (customerIndex >= unassignedCustomers.length) {
          // No more customers, create empty pod
          podsData.push({
            floorId: floor.floorId,
            ringId: ring.ringId,
            slotIndex,
            name: `${ringName} Pod ${slotIndex === -1 ? 'Center' : slotIndex}`,
            podType: slotIndex === -1 ? 'center' : 'standard',
          });
        } else {
          // Create pod with customer name
          const customer = unassignedCustomers[customerIndex];
          podsData.push({
            floorId: floor.floorId,
            ringId: ring.ringId,
            slotIndex,
            name: customer.displayName,
            podType: slotIndex === -1 ? 'center' : 'standard',
          });
          customerIndex++;
        }
      }

      // Batch create pods
      await prisma.pod.createMany({ data: podsData });

      // Create assignments for pods with customers
      const createdPods = await prisma.pod.findMany({
        where: { ringId: ring.ringId },
        orderBy: { slotIndex: 'asc' },
      });

      for (const pod of createdPods) {
        // Find the customer by matching the pod name (we named it after the customer)
        const matchingCustomer = unassignedCustomers.find(c => c.displayName === pod.name);
        if (matchingCustomer && !assignedEntityIds.has(matchingCustomer.entityId)) {
          await prisma.podAssignment.create({
            data: {
              podId: pod.podId,
              entityId: matchingCustomer.entityId,
            },
          });
          assignedEntityIds.add(matchingCustomer.entityId);
          newAssignments++;
        }
      }
    }

    console.log(`  Created floor ${floorIndex + 1}: ${floorName}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  const previouslyAssigned = allCustomers.length - unassignedCustomers.length;
  const totalAssigned = previouslyAssigned + assignedCount + newAssignments;
  console.log(`Total customers: ${allCustomers.length}`);
  console.log(`Previously assigned: ${previouslyAssigned}`);
  console.log(`Assigned to existing empty pods: ${assignedCount}`);
  console.log(`New floors created: ${newFloorsCreated}`);
  console.log(`New pod assignments: ${newAssignments}`);
  console.log(`Total now assigned: ${totalAssigned}`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
