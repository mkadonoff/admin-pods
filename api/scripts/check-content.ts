import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkContent() {
  const prisma = new PrismaClient();
  
  try {
    // Find the Customers tower
    const tower = await prisma.tower.findFirst({
      where: { name: 'Customers' }
    });
    
    if (!tower) {
      console.log('No Customers tower found');
      return;
    }
    
    console.log(`Found Customers tower: ID ${tower.towerId}`);
    
    // Find a floor in Customers tower with customer assignments
    const floor = await prisma.floor.findFirst({
      where: { towerId: tower.towerId },
      include: {
        rings: {
          include: {
            pods: {
              include: {
                assignments: { include: { entity: true } }
              }
            }
          }
        }
      }
    });
    
    if (!floor) {
      console.log('No floors found');
      return;
    }
    
    // Find first customer assignment
    for (const ring of floor.rings || []) {
      for (const pod of ring.pods || []) {
        for (const assignment of pod.assignments || []) {
          if (assignment.entity?.entityType === 'Customer') {
            console.log('Found Customer assignment:');
            console.log('  Entity ID:', assignment.entity.entityId);
            console.log('  Display Name:', assignment.entity.displayName);
            console.log('  Content:', assignment.entity.content);
            return;
          }
        }
      }
    }
    
    console.log('No customer assignments found in first floor');
  } finally {
    await prisma.$disconnect();
  }
}

checkContent().catch(console.error);
