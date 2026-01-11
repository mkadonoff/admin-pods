import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('Checking database state...\n');

  const towers = await prisma.tower.findMany({
    include: {
      _count: { select: { floors: true } }
    }
  });

  console.log('Towers:');
  towers.forEach(tower => {
    console.log(`  ${tower.towerId}: ${tower.name} (${tower._count.floors} floors)`);
  });

  const floors = await prisma.floor.findMany({
    orderBy: [{ towerId: 'asc' }, { name: 'asc' }]
  });

  console.log(`\nTotal Floors: ${floors.length}`);
  console.log('\nFloors by Tower:');
  const floorsByTower = floors.reduce((acc, floor) => {
    if (!acc[floor.towerId]) acc[floor.towerId] = [];
    acc[floor.towerId].push(floor.name);
    return acc;
  }, {} as Record<number, string[]>);

  Object.entries(floorsByTower).forEach(([towerId, floorNames]) => {
    const tower = towers.find(t => t.towerId === parseInt(towerId));
    console.log(`  Tower ${towerId} (${tower?.name}): ${floorNames.length} floors`);
    floorNames.forEach(name => console.log(`    - ${name}`));
  });

  await prisma.$disconnect();
}

checkData().catch(console.error);
