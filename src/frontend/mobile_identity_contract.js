(function attachMobileIdentityContract(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NoteConnectionMobileIdentity = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileIdentityContract() {
    'use strict';

    const SOURCE_URI_PREFIX = 'note://workspace/v1/';
    const SHA256_K = Object.freeze([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);

    function normalizeUnicodeText(value, fieldName) {
        if (typeof value !== 'string') {
            throw new Error(`${fieldName} must be a string.`);
        }
        if (value.includes('\0')) {
            throw new Error(`${fieldName} must not contain NUL characters.`);
        }
        return typeof value.normalize === 'function' ? value.normalize('NFC') : value;
    }

    function normalizePortablePath(relativePath) {
        const displayPath = normalizeUnicodeText(relativePath, 'Relative resource path')
            .replace(/\\/g, '/')
            .trim();
        const segments = displayPath.split('/').filter(Boolean);
        if (segments[0] && segments[0].toLowerCase() === 'knowledge_base') {
            segments.shift();
        }
        if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
            throw new Error(`Relative resource path is unsafe: ${relativePath}`);
        }
        return segments.map(segment => segment.toLowerCase()).join('/');
    }

    function createSourceUri(canonicalRelativePath) {
        return `${SOURCE_URI_PREFIX}${canonicalRelativePath
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/')}`;
    }

    function createCanonicalId(canonicalRelativePath) {
        return canonicalRelativePath.replace(/\.(?:md|markdown)$/i, '');
    }

    function utf8Encode(value) {
        if (typeof TextEncoder === 'function') {
            return new TextEncoder().encode(value);
        }
        const bytes = [];
        for (let index = 0; index < value.length; index += 1) {
            let codePoint = value.codePointAt(index);
            if (codePoint > 0xffff) {
                index += 1;
            }
            if (codePoint <= 0x7f) {
                bytes.push(codePoint);
            } else if (codePoint <= 0x7ff) {
                bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
            } else if (codePoint <= 0xffff) {
                bytes.push(
                    0xe0 | (codePoint >> 12),
                    0x80 | ((codePoint >> 6) & 0x3f),
                    0x80 | (codePoint & 0x3f),
                );
            } else {
                bytes.push(
                    0xf0 | (codePoint >> 18),
                    0x80 | ((codePoint >> 12) & 0x3f),
                    0x80 | ((codePoint >> 6) & 0x3f),
                    0x80 | (codePoint & 0x3f),
                );
            }
        }
        return Uint8Array.from(bytes);
    }

    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }

    function sha256HexSync(value) {
        const bytes = utf8Encode(normalizeUnicodeText(value, 'Resource content'));
        const bitLength = bytes.length * 8;
        const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
        const padded = new Uint8Array(paddedLength);
        padded.set(bytes);
        padded[bytes.length] = 0x80;
        const view = new DataView(padded.buffer);
        view.setUint32(padded.length - 4, bitLength >>> 0);
        view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));

        let h0 = 0x6a09e667;
        let h1 = 0xbb67ae85;
        let h2 = 0x3c6ef372;
        let h3 = 0xa54ff53a;
        let h4 = 0x510e527f;
        let h5 = 0x9b05688c;
        let h6 = 0x1f83d9ab;
        let h7 = 0x5be0cd19;
        const words = new Uint32Array(64);

        for (let offset = 0; offset < padded.length; offset += 64) {
            for (let index = 0; index < 16; index += 1) {
                words[index] = view.getUint32(offset + index * 4);
            }
            for (let index = 16; index < 64; index += 1) {
                const s0 = rightRotate(words[index - 15], 7)
                    ^ rightRotate(words[index - 15], 18)
                    ^ (words[index - 15] >>> 3);
                const s1 = rightRotate(words[index - 2], 17)
                    ^ rightRotate(words[index - 2], 19)
                    ^ (words[index - 2] >>> 10);
                words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
            }

            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let e = h4;
            let f = h5;
            let g = h6;
            let h = h7;
            for (let index = 0; index < 64; index += 1) {
                const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
                const choose = (e & f) ^ (~e & g);
                const temp1 = (h + sigma1 + choose + SHA256_K[index] + words[index]) >>> 0;
                const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
                const majority = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (sigma0 + majority) >>> 0;
                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + h) >>> 0;
        }

        return [h0, h1, h2, h3, h4, h5, h6, h7]
            .map(valuePart => valuePart.toString(16).padStart(8, '0'))
            .join('');
    }

    async function sha256Hex(value) {
        const normalized = normalizeUnicodeText(value, 'Resource content');
        const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
        if (cryptoApi && cryptoApi.subtle && typeof TextEncoder === 'function') {
            const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
            return Array.from(new Uint8Array(digest))
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        }
        return sha256HexSync(normalized);
    }

    async function createResourceIdentity(relativePath, legacyId, content) {
        const displayRelativePath = normalizeUnicodeText(relativePath, 'Relative resource path')
            .replace(/\\/g, '/')
            .trim();
        const canonicalRelativePath = normalizePortablePath(displayRelativePath);
        const normalizedLegacyId = normalizeUnicodeText(String(legacyId || ''), 'Legacy resource ID').trim();
        if (!normalizedLegacyId) {
            throw new Error('Legacy resource ID must not be empty.');
        }
        return {
            sourceUri: createSourceUri(canonicalRelativePath),
            canonicalId: createCanonicalId(canonicalRelativePath),
            revision: `sha256:${await sha256Hex(content)}`,
            identityAliases: Array.from(new Set([
                normalizedLegacyId,
                normalizedLegacyId.toLowerCase().endsWith('.md')
                    ? normalizedLegacyId
                    : `${normalizedLegacyId}.md`,
                displayRelativePath,
                canonicalRelativePath,
            ])),
        };
    }

    return Object.freeze({
        sourceUriPrefix: SOURCE_URI_PREFIX,
        normalizePortablePath,
        createSourceUri,
        sha256Hex,
        sha256HexSync,
        createResourceIdentity,
    });
}));
