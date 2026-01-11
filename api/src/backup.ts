import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function backup() {
  try {
    console.log('Starting database backup...');
    
    const data = {
      assemblies: await prisma.assembly.findMany(),
      floors: await prisma.floor.findMany(),
      rings: await prisma.ring.findMany(),
      pods: await prisma.pod.findMany(),
      entities: await prisma.entity.findMany(),
      assignments: await prisma.podAssignment.findMany(),
      timestamp: new Date().toISOString()
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const backupDir = path.join(process.cwd(), '..', 'backups');
    const filepath = path.join(backupDir, filename);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));

    console.log(`✓ Backup created successfully: ${filename}`);
    console.log(`  Location: ${filepath}`);
    console.log(`  Assemblies: ${data.assemblies.length}`);
    console.log(`  Floors: ${data.floors.length}`);
    console.log(`  Rings: ${data.rings.length}`);
    console.log(`  Pods: ${data.pods.length}`);
    console.log(`  Entities: ${data.entities.length}`);
    console.log(`  Assignments: ${data.assignments.length}`);
    
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
