/// <reference types="node" />
/**
 * Migration script to rename entity types:
 * - Person → User
 * - Company → Customer
 * - Device → Equipment
 * 
 * Run with: npm run migrate:entity-types
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateEntityTypes() {
  console.log('Starting entity type migration...\n');

  const migrations = [
    { from: ['Person', 'person'], to: 'User' },
    { from: ['Company', 'company'], to: 'Customer' },
    { from: ['Device', 'device'], to: 'Equipment' },
  ];

  for (const migration of migrations) {
    for (const oldType of migration.from) {
      const result = await prisma.entity.updateMany({
        where: { entityType: oldType },
        data: { entityType: migration.to },
      });

      if (result.count > 0) {
        console.log(`  Updated ${result.count} entities: "${oldType}" → "${migration.to}"`);
      }
    }
  }

  // Summary
  const summary = await prisma.entity.groupBy({
    by: ['entityType'],
    _count: { entityId: true },
  });

  console.log('\nEntity type summary after migration:');
  for (const row of summary) {
    console.log(`  ${row.entityType}: ${row._count.entityId} entities`);
  }

  console.log('\nMigration complete.');
}

migrateEntityTypes()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
