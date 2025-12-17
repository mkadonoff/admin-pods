import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createFloorRoutes(prisma: PrismaClient) {
  // GET /floors
  router.get('/', async (req: Request, res: Response) => {
    try {
      const floors = await prisma.floor.findMany({
        orderBy: { orderIndex: 'asc' },
      });
      res.json(floors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch floors' });
    }
  });

  // POST /floors
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, orderIndex } = req.body;
      const floor = await prisma.floor.create({
        data: { name, orderIndex },
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
