import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHlsPlayback } from '../src/lib/playbackReady.js';

test('Chưa READY khi playlist đang xử lý hoặc không phải HLS', async () => {
    for (const response of [new Response('', { status: 423 }), new Response('<html>Error</html>')]) {
        assert.equal(await checkHlsPlayback('https://cdn.test/master.m3u8', async () => response), false);
    }
});

test('Playlist có nhưng đoạn video chưa sẵn sàng thì chưa READY', async () => {
    const responses = [new Response('#EXTM3U\n#EXTINF:6,\npart.ts'), new Response('', { status: 404 })];
    assert.equal(await checkHlsPlayback('https://cdn.test/media.m3u8', async () => responses.shift()), false);
});

test('Chỉ READY khi master, media playlist và đoạn video tải được', async () => {
    const responses = [new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nmedia.m3u8'), new Response('#EXTM3U\n#EXTINF:6,\npart.ts'), new Response('a', { status: 206 })];
    assert.equal(await checkHlsPlayback('https://cdn.test/master.m3u8', async () => responses.shift()), true);
});

test('Không đi theo URL khác origin trong playlist', async () => {
    assert.equal(await checkHlsPlayback('https://cdn.test/master.m3u8', async () => new Response('#EXTM3U\nhttps://other.test/media.m3u8')), false);
});
