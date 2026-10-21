import * as statistics from '../services/statistics.service.js';

export async function overview(req, res) {
    res.json(await statistics.getStatistics(req.user, req.validatedQuery));
}

export async function detail(req, res) {
    res.json(await statistics.getStreamStatistics(req.user, req.params.id));
}
