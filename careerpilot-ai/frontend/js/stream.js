/**
 * stream.js — Server-Sent Events client and token renderer
 *
 * The server sends chunks via SSE data events.
 * The client accumulates chunks and calls `onComplete` once the
 * full response has been received.
 *
 * Supports two modes:
 *   parseAsText: false (default) — accumulates chunks and JSON.parse on [DONE]
 *   parseAsText: true            — accumulates chunks and returns raw string on [DONE]
 */

const StreamClient = (() => {

  /**
   * Open an SSE stream to the given endpoint.
   *
   * @param {object}   opts
   * @param {string}   opts.url          - API endpoint (POST)
   * @param {object}   opts.body         - JSON-serialisable request body
   * @param {boolean}  [opts.parseAsText]- If true, skip JSON.parse; onComplete gets raw string
   * @param {Function} opts.onChunk      - called with each raw text chunk
   * @param {Function} opts.onComplete   - called with the fully-parsed result object (or raw string)
   * @param {Function} opts.onError      - called with an Error on failure
   * @param {Function} [opts.onProgress] - called with a progress hint string
   * @returns {{ abort: Function }}       - returns a controller to cancel the stream
   */
  function openStream({ url, body, parseAsText = false, onChunk, onComplete, onError, onProgress }) {
    const controller = new AbortController();

    (async () => {
      try {
        if (onProgress) onProgress('Connecting to AI...');

        const response = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
          body:    JSON.stringify(body),
          signal:  controller.signal,
        });

        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const err = await response.json();
            detail = err.detail || detail;
          } catch (_) {}
          throw new Error(detail);
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';
        let   accumBuf = '';

        if (onProgress) onProgress('Receiving AI response...');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines: "data: <text>\n\n"
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const chunk = line.slice(6);

            // Server signals end of stream with [DONE]
            if (chunk.trim() === '[DONE]') {
              if (onProgress) onProgress('Processing results...');
              if (parseAsText) {
                onComplete(accumBuf);
              } else {
                try {
                  onComplete(JSON.parse(accumBuf));
                } catch (_) {
                  onError(new Error('Failed to parse AI response. Please try again.'));
                }
              }
              return;
            }

            // Server signals a mid-stream error with __ERROR__{...json...}
            if (chunk.startsWith('__ERROR__')) {
              try {
                const errObj = JSON.parse(chunk.slice(9));
                onError(new Error(errObj.error || 'Server error during analysis.'));
              } catch (_) {
                onError(new Error('Server error during analysis.'));
              }
              return;
            }

            // Each chunk is a JSON-encoded string — decode it to recover the
            // original text (including any embedded newlines or control chars).
            let decoded;
            try {
              decoded = JSON.parse(chunk);
            } catch (_) {
              decoded = chunk; // fallback: use raw chunk if decode fails
            }
            accumBuf += decoded;
            if (onChunk) onChunk(decoded);
          }
        }

        // Stream ended without [DONE] — attempt to use what we have
        if (accumBuf.trim()) {
          if (parseAsText) {
            onComplete(accumBuf);
          } else {
            try {
              onComplete(JSON.parse(accumBuf));
            } catch (_) {
              onError(new Error('Incomplete AI response received. Please try again.'));
            }
          }
        }

      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
        onError(err);
      }
    })();

    return {
      abort: () => controller.abort(),
    };
  }

  /**
   * Simple one-shot POST (no streaming) — used for extract-pdf.
   */
  async function postJSON(url, body) {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    return data;
  }

  /**
   * POST a FormData (used for file upload to /api/extract-pdf).
   */
  async function postForm(url, formData) {
    const response = await fetch(url, {
      method: 'POST',
      body:   formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    return data;
  }

  return { openStream, postJSON, postForm };
})();
