import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { statisticsQuerySchema } from '../validations/statistics.js';
import { streamIdSchema } from '../validations/stream.js';
import * as statistics from '../controllers/statistics.controller.js';

const router = Router();
router.use(authenticate);
router.get('/', validate(statisticsQuerySchema, 'query'), statistics.overview);
router.get('/streams/:id', validate(streamIdSchema, 'params'), statistics.detail);
export default router;
