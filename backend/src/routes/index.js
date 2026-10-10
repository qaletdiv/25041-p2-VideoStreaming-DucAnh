import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import videoRouter from './video.js';
import categoryRouter from './category.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/videos', videoRouter);
router.use('/categories', categoryRouter);

export default router;