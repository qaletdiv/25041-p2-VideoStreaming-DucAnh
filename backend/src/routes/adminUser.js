import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { listUsersSchema, userIdSchema, updateUserStatusSchema, createUserSchema, updateUserSchema, updateUserRoleSchema } from '../validations/adminUser.js';
import * as users from '../controllers/adminUser.controller.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));
router.get('/', validate(listUsersSchema, 'query'), users.listUsers);
router.post('/', validate(createUserSchema), users.createUser);
router.patch('/:id', validate(userIdSchema, 'params'), validate(updateUserSchema), users.updateUser);
router.patch('/:id/role', validate(userIdSchema, 'params'), validate(updateUserRoleSchema), users.updateUserRole);
router.patch('/:id/status', validate(userIdSchema, 'params'), validate(updateUserStatusSchema), users.updateUserStatus);
export default router;
