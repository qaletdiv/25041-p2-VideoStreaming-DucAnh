import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as uploadController from '../controllers/upload.controller.js';

const router = Router();

router.post('/signature', authenticate, uploadController.createSignature);

export default router;
