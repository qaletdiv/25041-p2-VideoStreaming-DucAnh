import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createStreamSchema, streamIdSchema } from '../validations/stream.js';
import * as streamController from '../controllers/stream.controller.js';

const router = Router();

router.post('/', authenticate, validate(createStreamSchema), streamController.createStream);
router.get('/:id', optionalAuthenticate, validate(streamIdSchema, 'params'), streamController.getStream);

export default router;
