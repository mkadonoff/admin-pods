import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createEntityRoutes(prisma: PrismaClient) {
  // GET /entities?type=Customer&q=acme
  router.get('/entities', async (req: Request, res: Response) => {
    try {
      const { type, q } = req.query;
      const where: any = {};

      if (type) {
        where.entityType = type;
      }
      if (q) {
        where.displayName = { contains: q, mode: 'insensitive' };
      }

      const entities = await prisma.entity.findMany({ where });
      res.json(entities);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entities' });
    }
  });

  // POST /entities
  router.post('/entities', async (req: Request, res: Response) => {
    try {
      const { entityType, displayName, externalSystemId, content } = req.body;
      const entity = await prisma.entity.create({
        data: { entityType, displayName, externalSystemId, content },
      });
      res.status(201).json(entity);
    } catch (error) {
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
