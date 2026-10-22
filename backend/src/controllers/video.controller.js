import * as videoService from '../services/video.service.js';
import { recordVideoView } from '../services/videoView.service.js';

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

export async function getUploadStatus(req, res) {
    res.json({ video: await videoService.getUploadStatus(req.user.id, req.params.id) });
}

export async function deleteVideo(req, res) {
    await videoService.deleteVideo(req.user.id, req.user.role, req.params.id);
    res.status(204).end();
}

export async function getVideo(req, res) {
    const video = await videoService.getPublicVideo(req.params.id);
    res.json({ video });
}

export async function incrementViews(req, res) {
    const { counted, viewCount, uploaderId } = await recordVideoView(req.params.id, req.user, req.body);
    if (counted) {
        req.app.get('io')?.to(`user:${uploaderId}`).to('statistics:admins')
            .emit('statistics:videos-changed');
    }
    res.json({ counted, viewCount });
}
