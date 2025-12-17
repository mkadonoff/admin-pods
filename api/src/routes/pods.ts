import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createPodRoutes(prisma: PrismaClient) {
  // GET /floors/:floorId/pods
  router.get('/floors/:floorId/pods', async (req: Request, res: Response) => {
    try {
      const { floorId } = req.params;
      const pods = await prisma.pod.findMany({
        where: { floorId: parseInt(floorId) },
        include: { assignments: true },
      });
      res.json(pods);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pods' });
    }
  });

  // PATCH /pods/:id
  router.patch('/pods/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, podType } = req.body;
      const pod = await prisma.pod.update({
        where: { podId: parseInt(id) },
        data: { ...(name && { name }), ...(podType && { podType }) },
      });
      res.json(pod);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update pod' });
    }
  });

  return router;
}
