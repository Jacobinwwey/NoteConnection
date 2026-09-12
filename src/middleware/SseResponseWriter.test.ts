import { Writable } from 'stream';
import { SseResponseWriter } from './SseResponseWriter';

describe('SSE delivery lifecycle', () => {
    function slowDestination() {
        const frames: string[] = [];
        const callbacks: Array<(error?: Error | null) => void> = [];
        const destination = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) {
            frames.push(chunk.toString()); callbacks.push(callback);
        } });
        return { destination, frames, callbacks };
    }

    test('waits for drain, preserves frame order and completes exactly once', async () => {
        const { destination, frames, callbacks } = slowDestination();
        const writer = new SseResponseWriter(destination, { maxBufferedBytes: 64, drainTimeoutMs: 1000 });
        const finish = jest.fn();
        destination.on('finish', finish);
        writer.write('first'); writer.write('second');
        const completed = writer.finish();
        expect(frames).toEqual(['first']);
        callbacks.shift()!();
        expect(frames).toEqual(['first', 'second']);
        callbacks.shift()!();
        await completed;
        await writer.finish();
        expect(finish).toHaveBeenCalledTimes(1);
        expect(writer.pendingBytes).toBe(0);
    });

    test('bounds pending bytes and destroys an overproducing stream', async () => {
        const { destination } = slowDestination();
        const writer = new SseResponseWriter(destination, { maxBufferedBytes: 8, drainTimeoutMs: 1000 });
        writer.write('123456');
        expect(() => writer.write('789')).toThrow('sse_buffer_limit');
        expect(destination.destroyed).toBe(true);
        await expect(writer.finish()).rejects.toThrow('sse_buffer_limit');
    });

    test.each(['close', 'error', 'timeout'])('settles %s while waiting for a slow client', async cause => {
        const { destination } = slowDestination();
        const writer = new SseResponseWriter(destination, { maxBufferedBytes: 64, drainTimeoutMs: 10 });
        writer.write('first'); writer.write('second');
        const completed = writer.finish();
        if (cause === 'close') destination.destroy();
        if (cause === 'error') destination.destroy(new Error('socket_failure'));
        await expect(completed).rejects.toThrow(cause === 'timeout' ? 'sse_drain_timeout' : cause === 'error' ? 'socket_failure' : 'sse_closed');
        expect(writer.pendingBytes).toBe(0);
        expect(destination.listenerCount('drain')).toBe(0);
    });
});
