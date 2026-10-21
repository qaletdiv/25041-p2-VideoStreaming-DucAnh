import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createStreamSchema, streamIdSchema, streamActionSchema, streamOverlaySchema } from '../validations/stream.js';
import * as streamController from '../controllers/stream.controller.js';
import * as donationController from '../controllers/donation.controller.js';
import { createDonationSchema, listDonationsSchema } from '../validations/donation.js';
import * as chatBanController from '../controllers/chatBan.controller.js';
import { createChatBanSchema, chatBanParamsSchema, listChatBansSchema } from '../validations/chatBan.js';

const router = Router();

router.post('/', authenticate, validate(createStreamSchema), streamController.createStream);
router.get('/', streamController.listStreams);
router.get('/:id', optionalAuthenticate, validate(streamIdSchema, 'params'), streamController.getStream);
router.get('/:id/bans', authenticate, validate(streamIdSchema, 'params'), validate(listChatBansSchema, 'query'), chatBanController.listChatBans);
router.post('/:id/bans', authenticate, validate(streamIdSchema, 'params'), validate(createChatBanSchema), chatBanController.createChatBan);
router.delete('/:id/bans/:userId', authenticate, validate(chatBanParamsSchema, 'params'), chatBanController.removeChatBan);
router.put('/:id/overlay', authenticate, validate(streamIdSchema, 'params'), validate(streamOverlaySchema), streamController.updateStreamOverlay);
router.get('/:id/donations', authenticate, validate(streamIdSchema, 'params'), validate(listDonationsSchema, 'query'), donationController.listDonations);
router.post('/:id/donations', authenticate, validate(streamIdSchema, 'params'), validate(createDonationSchema), donationController.createDonation);
router.post(
    '/:id/actions',
    authenticate,
    validate(streamIdSchema, 'params'),
    validate(streamActionSchema),
    streamController.controlStream,
);

export default router;
