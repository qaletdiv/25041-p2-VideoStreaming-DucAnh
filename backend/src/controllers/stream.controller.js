import * as streamService from '../services/stream.service.js';

export async function createStream(req, res) {
    const stream = await streamService.createStream(req.user, req.body);
    req.app.get('io').emit('stream:list-changed');
    res.status(201).json({ stream });
}

export async function listStreams(req, res) {
    const streams = await streamService.listStreams();
    res.json({ streams });
}

export async function updateStreamOverlay(req, res) {
    const overlay = await streamService.updateStreamOverlay(req.params.id, req.user, req.body);
    req.app.get('io').to(`stream:${req.params.id}`).emit('stream:overlay', overlay);
    res.json({ overlay });
}

export async function getStream(req, res) {
    const result = await streamService.getStream(req.params.id, req.user);
    res.json(result);
}

export async function controlStream(req, res) {
    const state = await streamService.controlStream(req.params.id, req.user, req.body);
    req.app.get('io').to(`stream:${req.params.id}`).emit('stream:state', state);
    if (state.status === 'ENDED') {
        req.app.get('io').emit('stream:ended', { streamId: req.params.id });
    }
    req.app.get('io').emit('stream:list-changed');
    res.json({ state });
}
