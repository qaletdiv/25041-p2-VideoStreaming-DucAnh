import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { listUsersSchema, userIdSchema, updateUserStatusSchema } from '../validations/adminUser.js';
import * as users from '../controllers/adminUser.controller.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));
router.get('/', validate(listUsersSchema, 'query'), users.listUsers);
router.patch('/:id/status', validate(userIdSchema, 'params'), validate(updateUserStatusSchema), users.updateUserStatus);
export default router;
