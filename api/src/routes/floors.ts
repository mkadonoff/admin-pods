import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createFloorRoutes(prisma: PrismaClient) {
  // GET /floors?towerIds=1,2,3 - get floors for specified towers
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { towerIds } = req.query;

      let where: any = {};
      if (towerIds && typeof towerIds === 'string') {
        const ids = towerIds
          .split(',')
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        if (ids.length > 0) {
          where = { towerId: { in: ids } };
        }
      }

      const floors = await prisma.floor.findMany({
        where,
        orderBy: [{ towerId: 'asc' }, { orderIndex: 'asc' }],
        include: {
          tower: { select: { towerId: true, name: true } },
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
      });
      res.json(floors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch floors' });
    }
  });

  // POST /floors - create floor (requires towerId)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, orderIndex, towerId } = req.body;
      if (!towerId) {
        return res.status(400).json({ error: 'towerId is required' });
      }
      const floor = await prisma.floor.create({
        data: {
          name,
          orderIndex: orderIndex ?? 0,
          towerId: parseInt(towerId),
        },
        include: {
          tower: { select: { towerId: true, name: true } },
        },
      });
      res.status(201).json(floor);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create floor' });
    }
  });

  // PATCH /floors/:id
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, orderIndex } = req.body;
      const floor = await prisma.floor.update({
        where: { floorId: parseInt(id) },
        data: { ...(name && { name }), ...(orderIndex !== undefined && { orderIndex }) },
        include: {
          tower: { select: { towerId: true, name: true } },
        },
      });
      res.json(floor);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update floor' });
    }
  });

  // DELETE /floors/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.floor.delete({
        where: { floorId: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete floor' });
    }
  });

  return router;
}
