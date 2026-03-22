/**
 * csv-enhanced — Example Delve plugin
 *
 * Demonstrates the plugin structure. Place this file (or any .js file
 * following the same shape) in your configured plugins directory and click
 * "Reload Plugins" in the Settings panel.
 *
 * This parser handles the fictional MIME type "text/csv-enhanced" and shows
 * basic header detection. Real plugins can import Node.js built-ins or
 * npm packages (the file runs in the same Node.js process as the Delve API).
 *
 * Export shape: module.exports = DelvePlugin  (CommonJS)
 * OR:           export default DelvePlugin    (ESM with .mjs extension)
 */

/** @type {import('@delve/core').DelvePlugin} */
module.exports = {
  name: 'csv-enhanced',
  version: '1.0.0',
  description: 'Enhanced CSV parser with header detection',

  parsers: [
    {
      mimeTypes: ['text/csv-enhanced'],
      parser: {
        supportedTypes: ['text/csv-enhanced'],

        /**
         * @param {Buffer} buffer  Raw file bytes
         * @param {string} filename  Original filename
         * @returns {Promise<{ ok: true, value: { text: string, metadata: Record<string, unknown> } } | { ok: false, error: string }>}
         */
        async parse(buffer, filename) {
          try {
            const raw = buffer.toString('utf-8');

            if (raw.trim().length === 0) {
              return { ok: false, error: `csv-enhanced: "${filename}" is empty` };
            }

            const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

            if (lines.length === 0) {
              return { ok: false, error: `csv-enhanced: "${filename}" has no data` };
            }

            // Detect headers from the first line
            const headers = lines[0].split(',').map((h) => h.trim());
            const dataLines = lines.slice(1);

            // Convert each data row to a natural language statement
            const statements = dataLines.map((line) => {
              const values = line.split(',').map((v) => v.trim());
              return headers
                .map((header, i) => `${header}: ${values[i] ?? ''}`)
                .join(', ');
            });

            const text = statements.join('\n');

            return {
              ok: true,
              value: {
                text,
                metadata: {
                  parser: 'csv-enhanced',
                  filename,
                  mimeType: 'text/csv-enhanced',
                  headers,
                  rowCount: dataLines.length,
                  characterCount: text.length,
                },
              },
            };
          } catch (e) {
            return {
              ok: false,
              error: `csv-enhanced failed to parse "${filename}": ${e instanceof Error ? e.message : String(e)}`,
            };
          }
        },
      },
    },
  ],
};
