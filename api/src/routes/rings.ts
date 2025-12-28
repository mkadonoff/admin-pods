import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createRingRoutes(prisma: PrismaClient) {
  // GET /floors/:floorId/rings
  router.get('/floors/:floorId/rings', async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const rings = await prisma.ring.findMany({
        where: { floorId: parseInt(floorId) },
      });
      res.json(rings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch rings' });
    }
  });

  // POST /floors/:floorId/rings
  // Auto-creates pods for each slot + center pod if radiusIndex=0
  router.post('/floors/:floorId/rings', async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const { name, radiusIndex, slots } = req.body;

      const ring = await prisma.ring.create({
        data: {
          floorId: parseInt(floorId),
          name,
          radiusIndex,
          slots,
        },
      });

      // Auto-create pods for each slot
      const podPromises = [];
      for (let i = 0; i < slots; i++) {
        podPromises.push(
          prisma.pod.create({
            data: {
              floorId: parseInt(floorId),
              ringId: ring.ringId,
              slotIndex: i,
              name: `${name} Pod ${i}`,
              podType: 'standard',
            },
          })
        );
      }

      // If center ring (radiusIndex=0), create center pod
      if (radiusIndex === 0) {
        podPromises.push(
          prisma.pod.create({
            data: {
              floorId: parseInt(floorId),
              ringId: ring.ringId,
              slotIndex: -1,
              name: `${name} Center`,
              podType: 'center',
            },
          })
        );
      }

      await Promise.all(podPromises);

      res.status(201).json(ring);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create ring' });
    }
  });

  // PATCH /rings/:id
  router.patch('/rings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, radiusIndex } = req.body;
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (radiusIndex !== undefined) data.radiusIndex = radiusIndex;
      const ring = await prisma.ring.update({
        where: { ringId: parseInt(id) },
        data,
      });
      res.json(ring);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update ring' });
    }
  });

  // DELETE /rings/:id
  router.delete('/rings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.ring.delete({
        where: { ringId: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete ring' });
    }
  });

  return router;
}
