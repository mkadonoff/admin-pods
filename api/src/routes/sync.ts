import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runFullSync, runSingleSync, FullSyncResult, SyncResult, EntitySyncType } from '../sync/eautomate';

const router = Router();

// Store last sync result in memory
let lastSyncResult: FullSyncResult | null = null;
let syncInProgress = false;
const lastSingleSyncResults: Record<EntitySyncType, { result: SyncResult; syncedAt: string } | null> = {
  users: null,
  customers: null,
  equipment: null,
  contacts: null,
};

export default function createSyncRoutes(prisma: PrismaClient) {
  // POST /sync/eautomate - trigger a full sync
  router.post('/eautomate', async (req: Request, res: Response) => {
    if (syncInProgress) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    const { digitalTwinId } = req.body;
    syncInProgress = true;

    try {
      const result = await runFullSync(prisma, digitalTwinId);
      lastSyncResult = result;
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'Sync failed', message: error.message });
    } finally {
      syncInProgress = false;
    }
  });

  // POST /sync/eautomate/:entityType - sync a single entity type
  router.post('/eautomate/:entityType', async (req: Request, res: Response) => {
    const { entityType } = req.params;
    const { digitalTwinId } = req.body;
    const validTypes: EntitySyncType[] = ['users', 'customers', 'equipment', 'contacts'];
    
    if (!validTypes.includes(entityType as EntitySyncType)) {
      return res.status(400).json({ 
        error: `Invalid entity type: ${entityType}. Valid types: ${validTypes.join(', ')}` 
      });
    }

    if (syncInProgress) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    syncInProgress = true;

    try {
      const { digitalTwinId: syncedTwinId, result } = await runSingleSync(prisma, entityType as EntitySyncType, digitalTwinId);
      const syncedAt = new Date().toISOString();
      lastSingleSyncResults[entityType as EntitySyncType] = { result, syncedAt };
      
      res.json({
        digitalTwinId: syncedTwinId,
        syncedAt,
        entityType: result.entityType,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        errors: result.errors,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Sync failed', message: error.message });
    } finally {
      syncInProgress = false;
    }
  });

  // GET /sync/status - get last sync status
  router.get('/status', async (req: Request, res: Response) => {
    res.json({
      syncInProgress,
      lastSync: lastSyncResult
        ? {
            syncedAt: lastSyncResult.syncedAt,
            digitalTwinId: lastSyncResult.digitalTwinId,
            totalCreated: lastSyncResult.totalCreated,
            totalUpdated: lastSyncResult.totalUpdated,
            totalDeleted: lastSyncResult.totalDeleted,
            success: lastSyncResult.success,
          }
        : null,
    });
  });

  // GET /sync/status/full - get full last sync result including per-entity details
  router.get('/status/full', async (req: Request, res: Response) => {
    res.json({
      syncInProgress,
      lastSync: lastSyncResult,
    });
  });

  return router;
}
