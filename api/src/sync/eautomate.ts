/**
 * e-automate ERP Sync Service
 * 
 * Syncs entities from CoRPG database to the "RPG Squarefoot Solutions" digital twin.
 * - CoUsers → User entities
 * - ARCustomers → Customer entities
 * - SCEquipments → Equipment entities (linked to Customer via content.customerId)
 * - CMContacts → Contact entities
 * 
 * Sync behavior:
 * - Only syncs active records (WHERE Active = 1)
 * - Upserts by externalSystemId
 * - Deletes entities that no longer exist in e-automate
 */

import { PrismaClient } from '@prisma/client';
import {
  fetchActiveUsers,
  fetchActiveCustomers,
  fetchActiveEquipment,
  fetchActiveContacts,
  closeEautomateConnection,
} from './eautomateDb';

const DIGITAL_TWIN_NAME = 'RPG Squarefoot Solutions';

export interface SyncResult {
  entityType: string;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface FullSyncResult {
  digitalTwinId: number;
  syncedAt: string;
  results: SyncResult[];
  totalCreated: number;
  totalUpdated: number;
  totalDeleted: number;
  success: boolean;
}

/**
 * Delete orphaned entities in batches to avoid SQL Server 2100 parameter limit
 */
async function deleteOrphanedEntities(
  prisma: PrismaClient,
  digitalTwinId: number,
  entityType: string,
  prefix: string,
  activeExternalIds: Set<string>
): Promise<number> {
  // Fetch all existing entities of this type with the prefix
  const existing = await prisma.entity.findMany({
    where: {
      digitalTwinId,
      entityType,
      externalSystemId: { startsWith: prefix },
    },
    select: { entityId: true, externalSystemId: true },
  });

  // Find orphans (exist in DB but not in active set)
  const orphanIds = existing
    .filter((e) => e.externalSystemId && !activeExternalIds.has(e.externalSystemId))
    .map((e) => e.entityId);

  if (orphanIds.length === 0) return 0;

  // Delete in batches of 1000
  const BATCH_SIZE = 1000;
  let deleted = 0;
  for (let i = 0; i < orphanIds.length; i += BATCH_SIZE) {
    const batch = orphanIds.slice(i, i + BATCH_SIZE);
    const result = await prisma.entity.deleteMany({
      where: { entityId: { in: batch } },
    });
    deleted += result.count;
  }

  return deleted;
}

/**
 * Get or create the RPG Squarefoot Solutions digital twin
 */
async function getOrCreateDigitalTwin(prisma: PrismaClient): Promise<number> {
  let twin = await prisma.digitalTwin.findUnique({
    where: { name: DIGITAL_TWIN_NAME },
  });

  if (!twin) {
    twin = await prisma.digitalTwin.create({
      data: {
        name: DIGITAL_TWIN_NAME,
        description: 'Digital twin synced from e-automate ERP (CoRPG database)',
      },
    });
    console.log(`Created digital twin: ${DIGITAL_TWIN_NAME} (ID: ${twin.digitalTwinId})`);
  }

  return twin.digitalTwinId;
}

/**
 * Sync Users from CoUsers table
 */
async function syncUsers(prisma: PrismaClient, digitalTwinId: number): Promise<SyncResult> {
  const result: SyncResult = { entityType: 'User', created: 0, updated: 0, deleted: 0, errors: [] };

  try {
    const eaUsers = await fetchActiveUsers();
    const externalIdSet = new Set(eaUsers.map((u) => `ea-user-${u.UserID}`));

    // Upsert each user
    for (const user of eaUsers) {
      const externalSystemId = `ea-user-${user.UserID}`;

      try {
        const existing = await prisma.entity.findFirst({
          where: { digitalTwinId, externalSystemId },
        });

        if (existing) {
          await prisma.entity.update({
            where: { entityId: existing.entityId },
            data: { displayName: user.Username },
          });
          result.updated++;
        } else {
          await prisma.entity.create({
            data: {
              entityType: 'User',
              displayName: user.Username,
              externalSystemId,
              digitalTwinId,
            },
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`User ${user.UserID}: ${err.message}`);
      }
    }

    // Delete orphaned entities using batched approach
    result.deleted = await deleteOrphanedEntities(prisma, digitalTwinId, 'User', 'ea-user-', externalIdSet);
  } catch (err: any) {
    result.errors.push(`Failed to fetch users: ${err.message}`);
  }

  return result;
}

/**
 * Sync Customers from ARCustomers table
 * Handles duplicate names by appending external ID suffix
 */
async function syncCustomers(prisma: PrismaClient, digitalTwinId: number): Promise<SyncResult> {
  const result: SyncResult = { entityType: 'Customer', created: 0, updated: 0, deleted: 0, errors: [] };

  try {
    const eaCustomers = await fetchActiveCustomers();
    const externalIdSet = new Set(eaCustomers.map((c) => `ea-cust-${c.CustomerID}`));

    // Track used display names to detect duplicates
    const usedDisplayNames = new Set<string>();
    
    // First, load existing entity display names for this type
    const existingEntities = await prisma.entity.findMany({
      where: { digitalTwinId, entityType: 'Customer' },
      select: { displayName: true, externalSystemId: true },
    });
    for (const e of existingEntities) {
      usedDisplayNames.add(e.displayName);
    }

    for (const customer of eaCustomers) {
      const externalSystemId = `ea-cust-${customer.CustomerID}`;

      try {
        const existing = await prisma.entity.findFirst({
          where: { digitalTwinId, externalSystemId },
        });

        // Determine display name - add ID suffix if name already used by different entity
        let displayName = customer.CustomerName;
        if (!existing && usedDisplayNames.has(displayName)) {
          displayName = `${customer.CustomerName} (${customer.CustomerID})`;
        }

        if (existing) {
          // For updates, keep existing name if it would cause a conflict
          const updateName = existing.displayName === customer.CustomerName || 
                            !usedDisplayNames.has(customer.CustomerName) 
                            ? customer.CustomerName 
                            : existing.displayName;
          await prisma.entity.update({
            where: { entityId: existing.entityId },
            data: { displayName: updateName },
          });
          result.updated++;
        } else {
          await prisma.entity.create({
            data: {
              entityType: 'Customer',
              displayName,
              externalSystemId,
              digitalTwinId,
            },
          });
          usedDisplayNames.add(displayName);
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Customer ${customer.CustomerID}: ${err.message}`);
      }
    }

    // Delete orphaned entities using batched approach
    result.deleted = await deleteOrphanedEntities(prisma, digitalTwinId, 'Customer', 'ea-cust-', externalIdSet);
  } catch (err: any) {
    result.errors.push(`Failed to fetch customers: ${err.message}`);
  }

  return result;
}

/**
 * Sync Equipment from SCEquipments table
 */
async function syncEquipment(prisma: PrismaClient, digitalTwinId: number): Promise<SyncResult> {
  const result: SyncResult = { entityType: 'Equipment', created: 0, updated: 0, deleted: 0, errors: [] };

  try {
    const eaEquipment = await fetchActiveEquipment();
    const externalIdSet = new Set(eaEquipment.map((e) => `ea-equip-${e.EquipmentID}`));

    for (const equipment of eaEquipment) {
      const externalSystemId = `ea-equip-${equipment.EquipmentID}`;
      const content = equipment.CustomerID
        ? JSON.stringify({ customerId: `ea-cust-${equipment.CustomerID}` })
        : null;

      try {
        const existing = await prisma.entity.findFirst({
          where: { digitalTwinId, externalSystemId },
        });

        if (existing) {
          await prisma.entity.update({
            where: { entityId: existing.entityId },
            data: { displayName: equipment.EquipmentNumber, content },
          });
          result.updated++;
        } else {
          await prisma.entity.create({
            data: {
              entityType: 'Equipment',
              displayName: equipment.EquipmentNumber,
              externalSystemId,
              content,
              digitalTwinId,
            },
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Equipment ${equipment.EquipmentID}: ${err.message}`);
      }
    }

    // Delete orphaned entities using batched approach
    result.deleted = await deleteOrphanedEntities(prisma, digitalTwinId, 'Equipment', 'ea-equip-', externalIdSet);
  } catch (err: any) {
    result.errors.push(`Failed to fetch equipment: ${err.message}`);
  }

  return result;
}

/**
 * Sync Contacts from CMContacts table
 * Handles duplicate names by appending external ID suffix
 */
async function syncContacts(prisma: PrismaClient, digitalTwinId: number): Promise<SyncResult> {
  const result: SyncResult = { entityType: 'Contact', created: 0, updated: 0, deleted: 0, errors: [] };

  try {
    const eaContacts = await fetchActiveContacts();
    const externalIdSet = new Set(eaContacts.map((c) => `ea-contact-${c.ContactID}`));

    // Track used display names to detect duplicates
    const usedDisplayNames = new Set<string>();
    
    // First, load existing entity display names for this type
    const existingEntities = await prisma.entity.findMany({
      where: { digitalTwinId, entityType: 'Contact' },
      select: { displayName: true, externalSystemId: true },
    });
    for (const e of existingEntities) {
      usedDisplayNames.add(e.displayName);
    }

    for (const contact of eaContacts) {
      const externalSystemId = `ea-contact-${contact.ContactID}`;

      try {
        const existing = await prisma.entity.findFirst({
          where: { digitalTwinId, externalSystemId },
        });

        // Determine display name - add ID suffix if name already used by different entity
        let displayName = contact.PrefFullName;
        if (!existing && usedDisplayNames.has(displayName)) {
          displayName = `${contact.PrefFullName} (${contact.ContactID})`;
        }

        if (existing) {
          // For updates, keep existing name if it would cause a conflict
          const updateName = existing.displayName === contact.PrefFullName || 
                            !usedDisplayNames.has(contact.PrefFullName) 
                            ? contact.PrefFullName 
                            : existing.displayName;
          await prisma.entity.update({
            where: { entityId: existing.entityId },
            data: { displayName: updateName },
          });
          result.updated++;
        } else {
          await prisma.entity.create({
            data: {
              entityType: 'Contact',
              displayName,
              externalSystemId,
              digitalTwinId,
            },
          });
          usedDisplayNames.add(displayName);
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Contact ${contact.ContactID}: ${err.message}`);
      }
    }

    // Delete orphaned entities using batched approach
    result.deleted = await deleteOrphanedEntities(prisma, digitalTwinId, 'Contact', 'ea-contact-', externalIdSet);
  } catch (err: any) {
    result.errors.push(`Failed to fetch contacts: ${err.message}`);
  }

  return result;
}

/**
 * Run full sync from e-automate to Digital Twin
 */
export async function runFullSync(prisma: PrismaClient): Promise<FullSyncResult> {
  console.log('Starting e-automate sync...');
  const startTime = Date.now();

  try {
    const digitalTwinId = await getOrCreateDigitalTwin(prisma);

    const results: SyncResult[] = [];

    console.log('Syncing Users...');
    results.push(await syncUsers(prisma, digitalTwinId));

    console.log('Syncing Customers...');
    results.push(await syncCustomers(prisma, digitalTwinId));

    console.log('Syncing Equipment...');
    results.push(await syncEquipment(prisma, digitalTwinId));

    console.log('Syncing Contacts...');
    results.push(await syncContacts(prisma, digitalTwinId));

    await closeEautomateConnection();

    const elapsed = Date.now() - startTime;
    const fullResult: FullSyncResult = {
      digitalTwinId,
      syncedAt: new Date().toISOString(),
      results,
      totalCreated: results.reduce((sum, r) => sum + r.created, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
      totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
      success: results.every((r) => r.errors.length === 0),
    };

    console.log(`\nSync completed in ${elapsed}ms`);
    console.log(`  Created: ${fullResult.totalCreated}`);
    console.log(`  Updated: ${fullResult.totalUpdated}`);
    console.log(`  Deleted: ${fullResult.totalDeleted}`);

    if (!fullResult.success) {
      console.log('\nErrors occurred:');
      for (const r of results) {
        for (const err of r.errors) {
          console.log(`  [${r.entityType}] ${err}`);
        }
      }
    }

    return fullResult;
  } catch (err: any) {
    await closeEautomateConnection();
    throw err;
  }
}
