/**
 * stream.js — Server-Sent Events client and token renderer
 *
 * Phase 1: stub with full interface defined.
 * Phase 2: will replace the stub body with real SSE fetch + JSON parsing.
 *
 * The server sends a single JSON object delimited by SSE data events.
 * The client accumulates chunks and calls `onComplete` once the full
 * JSON has been received.
 */

const StreamClient = (() => {

  /**
   * Open an SSE stream to the given endpoint.
   *
   * @param {object}   opts
   * @param {string}   opts.url          - API endpoint (POST)
   * @param {object}   opts.body         - JSON-serialisable request body
   * @param {Function} opts.onChunk      - called with each raw text chunk
   * @param {Function} opts.onComplete   - called with the fully-parsed result object
   * @param {Function} opts.onError      - called with an Error on failure
   * @param {Function} [opts.onProgress] - called with a progress hint string
   * @returns {{ abort: Function }}       - returns a controller to cancel the stream
   */
  function openStream({ url, body, onChunk, onComplete, onError, onProgress }) {
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
        let   jsonBuf = '';

        if (onProgress) onProgress('Receiving AI analysis...');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines: "data: <text>\n\n"
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const chunk = line.slice(6);

              // Server signals end of stream with [DONE]
              if (chunk.trim() === '[DONE]') {
                if (onProgress) onProgress('Processing results...');
                try {
                  const parsed = JSON.parse(jsonBuf);
                  onComplete(parsed);
                } catch (parseErr) {
                  onError(new Error('Failed to parse AI response. Please try again.'));
                }
                return;
              }

              jsonBuf += chunk;
              if (onChunk) onChunk(chunk);
            }
          }
        }

        // If stream ends without [DONE], attempt to parse what we have
        if (jsonBuf.trim()) {
          try {
            const parsed = JSON.parse(jsonBuf);
            onComplete(parsed);
          } catch (_) {
            onError(new Error('Incomplete response from AI. Please try again.'));
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
