import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createAssemblyRoutes(prisma: PrismaClient) {
  // GET /assemblies - list all assemblies with floor count
  router.get('/', async (req: Request, res: Response) => {
    try {
      const assemblies = await prisma.tower.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { floors: true } },
        },
      });
      res.json(assemblies);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assemblies' });
    }
  });

  // GET /assemblies/:id - get assembly with all floors, rings, pods
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assembly = await prisma.tower.findUnique({
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
      if (!assembly) {
        return res.status(404).json({ error: 'Assembly not found' });
      }
      res.json(assembly);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assembly' });
    }
  });

  // POST /assemblies - create new assembly
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, digitalTwinId } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!digitalTwinId || typeof digitalTwinId !== 'number') {
        return res.status(400).json({ error: 'digitalTwinId is required' });
      }
      const assembly = await prisma.tower.create({
        data: { name: name.trim(), digitalTwinId },
      });
      res.status(201).json(assembly);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Assembly name already exists' });
      }
      res.status(500).json({ error: 'Failed to create assembly' });
    }
  });

  // PATCH /assemblies/:id - rename assembly
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const assembly = await prisma.tower.update({
        where: { towerId: parseInt(id) },
        data: { name: name?.trim() },
      });
      res.json(assembly);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Assembly name already exists' });
      }
      res.status(400).json({ error: 'Failed to update assembly' });
    }
  });

  // DELETE /assemblies/:id - delete assembly (cascades to floors)
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.tower.delete({ where: { towerId: parseInt(id) } });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete assembly' });
    }
  });

  return router;
}
