import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check tower
  const tower = await prisma.tower.findFirst({ where: { name: 'Customers' } });
  console.log('Tower:', tower);
  
  // Check floors
  const floors = await prisma.floor.findMany({ 
    where: { towerId: tower?.towerId },
    take: 5,
    orderBy: { orderIndex: 'asc' }
  });
  console.log('First 5 floors:', floors);
  
  // Check floor count
  const floorCount = await prisma.floor.count({ where: { towerId: tower?.towerId } });
  console.log('Total floors in tower:', floorCount);
  
  // Check pods on first floor
  if (floors.length > 0) {
    const podsOnFloor1 = await prisma.pod.count({ where: { floorId: floors[0].floorId } });
    console.log('Pods on first floor:', podsOnFloor1);
    
    // Sample pods
    const samplePods = await prisma.pod.findMany({ 
      where: { floorId: floors[0].floorId },
      take: 3,
      include: { assignments: { include: { entity: true } } }
    });
    console.log('Sample pods with assignments:');
    for (const pod of samplePods) {
      console.log(`  Pod ${pod.podId}: ${pod.name} - ${pod.assignments.length} assignments`);
    }
  }
  
  // Total assignments
  const totalAssignments = await prisma.podAssignment.count({
    where: { entity: { entityType: 'Customer' } }
  });
  console.log('Total Customer assignments:', totalAssignments);
  
  // Check which digital twin the tower belongs to
  if (tower) {
    const dt = await prisma.digitalTwin.findUnique({ where: { digitalTwinId: tower.digitalTwinId } });
    console.log('Tower digital twin:', dt?.name, '(ID:', dt?.digitalTwinId, ')');
  }
  
  await prisma.$disconnect();
}

check();
