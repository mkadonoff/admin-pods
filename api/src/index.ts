import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import createFloorRoutes from './routes/floors';
import createRingRoutes from './routes/rings';
import createPodRoutes from './routes/pods';
import createEntityRoutes from './routes/entities';
import createAssignmentRoutes from './routes/assignments';
import createTowerRoutes from './routes/towers';
import createDigitalTwinRoutes from './routes/digitalTwins';
import createSyncRoutes from './routes/sync';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/digital-twins', createDigitalTwinRoutes(prisma));
app.use('/towers', createTowerRoutes(prisma));
app.use('/floors', createFloorRoutes(prisma));
app.use('/', createRingRoutes(prisma));
app.use('/', createPodRoutes(prisma));
app.use('/', createEntityRoutes(prisma));
app.use('/', createAssignmentRoutes(prisma));
app.use('/sync', createSyncRoutes(prisma));

// Health check
app.get('/health', async (req, res) => {
  const environment = process.env.APP_ENV_NAME || process.env.NODE_ENV || 'development';
  const gitCommit = process.env.GIT_COMMIT || process.env.VITE_GIT_COMMIT || null;
  const payload = {
    status: 'ok',
    database: 'ok',
    gitCommit,
    serverTime: new Date().toISOString(),
    environment,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(payload);
  } catch (error) {
    res.status(503).json({
      ...payload,
      status: 'error',
      database: 'unreachable',
      error: 'Database connectivity failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
