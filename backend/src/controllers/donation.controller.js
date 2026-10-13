import * as donationService from '../services/donation.service.js';

export async function listDonations(req, res) {
    res.json(await donationService.listDonations(req.params.id, req.user, req.validatedQuery));
}

export async function createDonation(req, res) {
    const { donation, created } = await donationService.createDonation(req.params.id, req.user, req.body);
    if (created) req.app.get('io').to(`stream:${req.params.id}`).emit('stream:donation', donation);
    res.status(created ? 201 : 200).json({ donation });
}
