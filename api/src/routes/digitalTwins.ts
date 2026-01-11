import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export default function createDigitalTwinRoutes(prisma: PrismaClient) {
  const router = Router();

  // GET /digital-twins - List all digital twins
  router.get('/', async (req: Request, res: Response) => {
    try {
      const digitalTwins = await prisma.digitalTwin.findMany({
        include: {
          _count: {
            select: { towers: true, entities: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      res.json(digitalTwins);
    } catch (error) {
      console.error('Error fetching digital twins:', error);
      res.status(500).json({ error: 'Failed to fetch digital twins' });
    }
  });

  // GET /digital-twins/:id - Get single digital twin
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const digitalTwin = await prisma.digitalTwin.findUnique({
        where: { digitalTwinId: parseInt(req.params.id) },
        include: {
          towers: {
            include: {
              _count: {
                select: { floors: true }
              }
            }
          },
          entities: true,
          _count: {
            select: { towers: true, entities: true }
          }
        }
      });
      
      if (!digitalTwin) {
        return res.status(404).json({ error: 'Digital twin not found' });
      }
      
      res.json(digitalTwin);
    } catch (error) {
      console.error('Error fetching digital twin:', error);
      res.status(500).json({ error: 'Failed to fetch digital twin' });
    }
  });

  // POST /digital-twins - Create digital twin
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const digitalTwin = await prisma.digitalTwin.create({
        data: { name, description }
      });
      
      res.status(201).json(digitalTwin);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Digital twin name already exists' });
      }
      console.error('Error creating digital twin:', error);
      res.status(500).json({ error: 'Failed to create digital twin' });
    }
  });

  // PATCH /digital-twins/:id - Update digital twin
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      const digitalTwin = await prisma.digitalTwin.update({
        where: { digitalTwinId: parseInt(req.params.id) },
        data: { name, description }
      });
      
      res.json(digitalTwin);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Digital twin not found' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Digital twin name already exists' });
      }
      console.error('Error updating digital twin:', error);
      res.status(500).json({ error: 'Failed to update digital twin' });
    }
  });

  // DELETE /digital-twins/:id - Delete digital twin
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await prisma.digitalTwin.delete({
        where: { digitalTwinId: parseInt(req.params.id) }
      });
      
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Digital twin not found' });
      }
      console.error('Error deleting digital twin:', error);
      res.status(500).json({ error: 'Failed to delete digital twin' });
    }
  });

  return router;
}
