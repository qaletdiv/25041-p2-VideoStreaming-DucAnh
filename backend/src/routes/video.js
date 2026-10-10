import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { listVideosSchema } from '../validations/video.js';
import * as videoController from '../controllers/video.controller.js';

const router = Router();

// Công khai (khách cũng xem được trang chủ); tham số nằm ở query string
router.get('/', validate(listVideosSchema, 'query'), videoController.listVideos);

export default router;
