import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createTowerRoutes(prisma: PrismaClient) {
  // GET /towers - list all towers with floor count
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { digitalTwinId } = req.query;
      
      const where = digitalTwinId 
        ? { digitalTwinId: parseInt(digitalTwinId as string) }
        : {};
      
      const towers = await prisma.tower.findMany({
        where,
        orderBy: { orderIndex: 'asc' },
        include: {
          digitalTwin: true,
          _count: { select: { floors: true } },
        },
      });
      res.json(towers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch towers' });
    }
  });

  // GET /towers/:id - get tower with all floors, rings, pods
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tower = await prisma.tower.findUnique({
        where: { towerId: parseInt(id) },
        include: {
          floors: {
            orderBy: { orderIndex: 'asc' },
            include: {
              rings: {
                orderBy: { radiusIndex: 'asc' },
                include: {
                  pods: {
                    orderBy: { slotIndex: 'asc' },
                    include: {
                      assignments: {
                        include: { entity: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!tower) {
        return res.status(404).json({ error: 'Tower not found' });
      }
      res.json(tower);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tower' });
    }
  });

  // POST /towers - create new tower
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, digitalTwinId, orderIndex } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!digitalTwinId) {
        return res.status(400).json({ error: 'Digital twin ID is required' });
      }
      const tower = await prisma.tower.create({  
        data: { 
          name: name.trim(),
          digitalTwinId: parseInt(digitalTwinId),
          orderIndex: orderIndex ?? 0,
        },
      });
      res.status(201).json(tower);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Tower name already exists' });
      }
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid digital twin ID' });
      }
      res.status(500).json({ error: 'Failed to create tower' });
    }
  });

  // PATCH /towers/:id - update tower (name, orderIndex)
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, orderIndex } = req.body;
      const tower = await prisma.tower.update({
        where: { towerId: parseInt(id) },
        data: { 
          ...(name !== undefined && { name: name?.trim() }),
          ...(orderIndex !== undefined && { orderIndex }),
        },
      });
      res.json(tower);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Tower name already exists' });
      }
      res.status(400).json({ error: 'Failed to update tower' });
    }
  });

  // DELETE /towers/:id - delete tower (cascades to floors)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.tower.delete({ where: { towerId: parseInt(id) } });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete tower' });
    }
  });

  return router;
}
