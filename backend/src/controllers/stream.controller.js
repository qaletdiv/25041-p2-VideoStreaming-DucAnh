import * as streamService from '../services/stream.service.js';

export async function createStream(req, res) {
    const stream = await streamService.createStream(req.user, req.body);
    res.status(201).json({ stream });
}

export async function getStream(req, res) {
    const result = await streamService.getStream(req.params.id, req.user);
    res.json(result);
}

export async function controlStream(req, res) {
    const state = await streamService.controlStream(req.params.id, req.user, req.body);
    req.app.get('io').to(`stream:${req.params.id}`).emit('stream:state', state);
    res.json({ state });
}
