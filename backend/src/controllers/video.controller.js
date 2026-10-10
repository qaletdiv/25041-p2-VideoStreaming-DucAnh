import * as videoService from '../services/video.service.js';

export async function listVideos(req, res) {
    const result = await videoService.listVideos(req.validatedQuery);
    res.json(result);
}
