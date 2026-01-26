/// <reference types="node" />
/**
 * CLI script to run e-automate sync
 * 
 * Run with: npm run sync:eautomate
 * 
 * Can be scheduled via Windows Task Scheduler to run every 15 minutes.
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { runFullSync } from '../src/sync/eautomate';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('e-automate ERP Sync');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log();

  try {
    const result = await runFullSync(prisma);

    console.log();
    console.log('='.repeat(60));
    console.log('Sync Summary');
    console.log('='.repeat(60));
    console.log(`Digital Twin ID: ${result.digitalTwinId}`);
    console.log(`Completed at: ${result.syncedAt}`);
    console.log();
    console.log('Results by entity type:');
    for (const r of result.results) {
      console.log(`  ${r.entityType}:`);
      console.log(`    Created: ${r.created}`);
      console.log(`    Updated: ${r.updated}`);
      console.log(`    Deleted: ${r.deleted}`);
      if (r.errors.length > 0) {
        console.log(`    Errors: ${r.errors.length}`);
      }
    }
    console.log();
    console.log(`Overall: ${result.success ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`);

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
