import * as statistics from '../services/statistics.service.js';
import { getVideoStatistics } from '../services/videoStatistics.service.js';

export async function videos(req, res) {
    res.json(await getVideoStatistics(req.user, req.validatedQuery));
}

export async function overview(req, res) {
    res.json(await statistics.getStatistics(req.user, req.validatedQuery));
}

export async function detail(req, res) {
    res.json(await statistics.getStreamStatistics(req.user, req.params.id));
}
