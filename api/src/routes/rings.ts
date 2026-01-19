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

      const floorIdNumber = parseInt(floorId, 10);

      const ring = await prisma.$transaction(async (tx) => {
        const createdRing = await tx.ring.create({
          data: {
            floorId: floorIdNumber,
            name,
            radiusIndex,
            slots,
          },
        });

        const podsData = [];

        // For center ring (radius=0), only create center pod
        if (radiusIndex === 0) {
          podsData.push({
            floorId: floorIdNumber,
            ringId: createdRing.ringId,
            slotIndex: -1,
            name: `${name} Center`,
            podType: 'center',
          });
        } else {
          // For outer rings, create slot-based pods
          for (let idx = 0; idx < slots; idx++) {
            podsData.push({
              floorId: floorIdNumber,
              ringId: createdRing.ringId,
              slotIndex: idx,
              name: `${name} Pod ${idx}`,
              podType: 'standard',
            });
          }
        }

        if (podsData.length > 0) {
          await tx.pod.createMany({ data: podsData });
        }

        return createdRing;
      });

      res.status(201).json(ring);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create ring' });
    }
  });

  // PATCH /rings/:id
  router.patch('/rings/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, radiusIndex, slots } = req.body;
      const ringId = parseInt(id);
      
      // Get current ring with pods
      const currentRing = await prisma.ring.findUnique({
        where: { ringId },
        include: { pods: true },
      });
      
      if (!currentRing) {
        return res.status(404).json({ error: 'Ring not found' });
      }
      
      // Handle slot count change
      if (slots !== undefined && slots !== currentRing.slots && currentRing.radiusIndex !== 0) {
        const currentSlots = currentRing.slots;
        const newSlots = slots;
        
        if (newSlots < currentSlots) {
          // Remove pods with slotIndex >= newSlots
          await prisma.pod.deleteMany({
            where: {
              ringId,
              slotIndex: { gte: newSlots },
            },
          });
        } else if (newSlots > currentSlots) {
          // Add pods for new slots
          const podsData = [];
          for (let idx = currentSlots; idx < newSlots; idx++) {
            podsData.push({
              floorId: currentRing.floorId,
              ringId,
              slotIndex: idx,
              name: `${currentRing.name} Pod ${idx}`,
              podType: 'standard',
            });
          }
          await prisma.pod.createMany({ data: podsData });
        }
      }
      
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (radiusIndex !== undefined) data.radiusIndex = radiusIndex;
      if (slots !== undefined) data.slots = slots;
      
      const ring = await prisma.ring.update({
        where: { ringId },
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
