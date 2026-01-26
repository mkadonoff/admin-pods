import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { runFullSync, FullSyncResult } from '../sync/eautomate';

const router = Router();

// Store last sync result in memory
let lastSyncResult: FullSyncResult | null = null;
let syncInProgress = false;

export default function createSyncRoutes(prisma: PrismaClient) {
  // POST /sync/eautomate - trigger a full sync
  router.post('/eautomate', async (req: Request, res: Response) => {
    if (syncInProgress) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    syncInProgress = true;

    try {
      const result = await runFullSync(prisma);
      lastSyncResult = result;
      res.json(result);
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
