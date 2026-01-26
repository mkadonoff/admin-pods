import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createEntityRoutes(prisma: PrismaClient) {
  // GET /entities?digitalTwinId=1&type=Customer&q=acme&limit=100&offset=0
  router.get('/entities', async (req: Request, res: Response) => {
    try {
      const { digitalTwinId, type, q, limit, offset } = req.query;
      
      if (!digitalTwinId) {
        return res.status(400).json({ error: 'digitalTwinId is required' });
      }
      
      const where: any = {
        digitalTwinId: parseInt(digitalTwinId as string)
      };

      if (type) {
        where.entityType = type;
      }
      if (q) {
        where.displayName = { contains: q, mode: 'insensitive' };
      }

      // Default limit of 200, max 1000 to prevent overloading
      const take = Math.min(parseInt(limit as string) || 200, 1000);
      const skip = parseInt(offset as string) || 0;

      const [entities, totalCount] = await Promise.all([
        prisma.entity.findMany({ 
          where,
          take,
          skip,
          orderBy: { displayName: 'asc' },
        }),
        prisma.entity.count({ where }),
      ]);

      res.json({
        data: entities,
        pagination: {
          total: totalCount,
          limit: take,
          offset: skip,
          hasMore: skip + entities.length < totalCount,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entities' });
    }
  });

  // GET /entities/types?digitalTwinId=1 - Get entity type counts for filtering
  router.get('/entities/types', async (req: Request, res: Response) => {
    try {
      const { digitalTwinId } = req.query;
      
      if (!digitalTwinId) {
        return res.status(400).json({ error: 'digitalTwinId is required' });
      }

      const typeCounts = await prisma.entity.groupBy({
        by: ['entityType'],
        where: { digitalTwinId: parseInt(digitalTwinId as string) },
        _count: { entityId: true },
        orderBy: { entityType: 'asc' },
      });

      res.json(typeCounts.map(t => ({ 
        entityType: t.entityType, 
        count: t._count.entityId 
      })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entity types' });
    }
  });

  // POST /entities
  router.post('/entities', async (req: Request, res: Response) => {
    try {
      const { entityType, displayName, externalSystemId, content, digitalTwinId } = req.body;
      
      if (!digitalTwinId) {
        return res.status(400).json({ error: 'digitalTwinId is required' });
      }
      
      const entity = await prisma.entity.create({
        data: { entityType, displayName, externalSystemId, content, digitalTwinId: parseInt(digitalTwinId) },
      });
      res.status(201).json(entity);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Entity with this name and type already exists in this digital twin' });
      }
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid digital twin ID' });
      }
      res.status(400).json({ error: 'Failed to create entity' });
    }
  });

  // PATCH /entities/:id
  router.patch('/entities/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { displayName, externalSystemId, content } = req.body;
      const data: any = {};
      if (displayName !== undefined) data.displayName = displayName;
      if (externalSystemId !== undefined) data.externalSystemId = externalSystemId;
      if (content !== undefined) data.content = content;
      const entity = await prisma.entity.update({
        where: { entityId: parseInt(id) },
        data,
      });
      res.json(entity);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update entity' });
    }
  });

  // DELETE /entities/:id
  router.delete('/entities/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.entity.delete({
        where: { entityId: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete entity' });
    }
  });

  return router;
}
