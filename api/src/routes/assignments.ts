import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

export default function createAssignmentRoutes(prisma: PrismaClient) {
  // GET /assignments - get all assignments
  router.get('/assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await prisma.podAssignment.findMany({
        include: { 
          entity: true,
          pod: { select: { podId: true, name: true } }
        },
      });
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  // GET /pods/:podId/assignments
  router.get('/pods/:podId/assignments', async (req: Request, res: Response) => {
    try {
      const { podId } = req.params;
      const assignments = await prisma.podAssignment.findMany({
        where: { podId: parseInt(podId) },
        include: { entity: true },
      });
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  // POST /pods/:podId/assignments
  router.post('/pods/:podId/assignments', async (req: Request, res: Response) => {
    try {
      const { podId } = req.params;
      const { entityId, roleTag } = req.body;

      const assignment = await prisma.podAssignment.create({
        data: {
          podId: parseInt(podId),
          entityId,
          roleTag,
        },
        include: { entity: true },
      });
      res.status(201).json(assignment);
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Entity already assigned to this pod' });
      } else {
        res.status(400).json({ error: 'Failed to create assignment' });
      }
    }
  });

  // DELETE /assignments/:id
  router.delete('/assignments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.podAssignment.delete({
        where: { assignmentId: parseInt(id) },
      });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete assignment' });
    }
  });

  return router;
}
