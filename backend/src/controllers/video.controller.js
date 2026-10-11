import * as videoService from '../services/video.service.js';

export async function listVideos(req, res) {
    const result = await videoService.listVideos(req.validatedQuery);
    res.json(result);
}

export async function createVideo(req, res) {
    const video = await videoService.createVideo(req.user.id, req.body);
    res.status(201).json({ video });
}

export async function listMyVideos(req, res) {
    const result = await videoService.listMyVideos(req.user.id, req.validatedQuery);
    res.json(result);
}

export async function deleteVideo(req, res) {
    await videoService.deleteVideo(req.user.id, req.user.role, req.params.id);
    res.status(204).end();
}
