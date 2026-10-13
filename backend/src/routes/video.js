import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { listVideosSchema, createVideoSchema, listMyVideosSchema, videoIdSchema } from '../validations/video.js';
import * as videoController from '../controllers/video.controller.js';

const router = Router();

// Công khai (khách cũng xem được trang chủ); tham số nằm ở query string
router.get('/', validate(listVideosSchema, 'query'), videoController.listVideos);

// Cần đăng nhập
router.get('/mine', authenticate, validate(listMyVideosSchema, 'query'), videoController.listMyVideos);
router.get('/:id/status', authenticate, validate(videoIdSchema, 'params'), videoController.getUploadStatus);
router.post('/', authenticate, validate(createVideoSchema), videoController.createVideo);
router.delete('/:id', authenticate, videoController.deleteVideo);

// Công khai: xem chi tiết và đếm lượt xem
router.get('/:id', validate(videoIdSchema, 'params'), videoController.getVideo);
router.post('/:id/views', validate(videoIdSchema, 'params'), videoController.incrementViews);

export default router;
