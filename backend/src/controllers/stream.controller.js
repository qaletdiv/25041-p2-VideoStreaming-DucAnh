import * as streamService from '../services/stream.service.js';

export async function createStream(req, res) {
    const stream = await streamService.createStream(req.user, req.body);
    res.status(201).json({ stream });
}

export async function getStream(req, res) {
    const result = await streamService.getStream(req.params.id, req.user);
    res.json(result);
}
