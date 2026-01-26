import { PrismaClient } from '@prisma/client';
import { runSingleSync, EntitySyncType } from '../src/sync/eautomate';
import dotenv from 'dotenv';

dotenv.config();

async function syncSingle(entityType: EntitySyncType) {
  const prisma = new PrismaClient();
  
  try {
    console.log(`Syncing ${entityType} only...`);
    const startTime = Date.now();
    const { digitalTwinId, result } = await runSingleSync(prisma, entityType);
    const elapsed = Date.now() - startTime;
    
    console.log(`\nSync completed in ${elapsed}ms`);
    console.log(`Digital Twin ID: ${digitalTwinId}`);
    console.log(`Entity Type: ${result.entityType}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Deleted: ${result.deleted}`);
    
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`));
      if (result.errors.length > 5) {
        console.log(`    ... and ${result.errors.length - 5} more`);
      }
    }
    
    // Verify content field has state
    if (entityType === 'customers') {
      const sample = await prisma.entity.findFirst({
        where: { 
          digitalTwinId,
          entityType: 'Customer',
          content: { not: null },
        },
      });
      if (sample?.content) {
        console.log(`\nSample customer content: ${sample.content}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

const entityType = (process.argv[2] || 'customers') as EntitySyncType;
syncSingle(entityType).catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
