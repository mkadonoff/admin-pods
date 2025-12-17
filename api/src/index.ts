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

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/floors', createFloorRoutes(prisma));
app.use('/', createRingRoutes(prisma));
app.use('/', createPodRoutes(prisma));
app.use('/entities', createEntityRoutes(prisma));
app.use('/assignments', createAssignmentRoutes(prisma));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
