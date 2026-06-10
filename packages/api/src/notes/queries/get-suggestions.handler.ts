import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { GetSuggestionsQuery } from './get-suggestions.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

/**
 * Given a ranked list of candidate suggestions, deduplicate by lowercase title
 * keeping only the highest-scoring row per title (the list is already sorted
 * descending by score, so the first occurrence of each title wins).
 *
 * Rows with a null title are treated as unique (never merged with each other
 * or with titled rows — a null title cannot collide).
 */
export function dedupeByTitle(
  rows: ReadonlyArray<{ sourceId: string; title: string | null; filename: string; score: number }>,
): Array<{ sourceId: string; title: string | null; filename: string; score: number }> {
  const seen = new Set<string>();
  const result: Array<{ sourceId: string; title: string | null; filename: string; score: number }> =
    [];
  for (const row of rows) {
    const key = row.title !== null ? row.title.toLowerCase() : null;
    if (key !== null) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(row);
  }
  return result;
}

export interface SuggestionEntry {
  readonly sourceId: string;
  readonly title: string | null;
  readonly filename: string;
  readonly score: number;
}

@QueryHandler(GetSuggestionsQuery)
export class GetSuggestionsHandler implements IQueryHandler<GetSuggestionsQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetSuggestionsQuery): Promise<readonly SuggestionEntry[]> {
    const { noteId, limit } = query;

    // Step 0: Fetch the title of the current note so we can exclude notes that
    // share its title (a note must never see itself or a generated copy of itself
    // in its own Suggested Links).
    const noteRows = await this.db.execute(
      sql`SELECT title FROM sources WHERE id = ${noteId}::uuid LIMIT 1`,
    );
    const currentNoteTitle =
      (noteRows as unknown as { title: string | null }[])[0]?.title ?? null;
    const currentNoteTitleLower = currentNoteTitle !== null ? currentNoteTitle.toLowerCase() : null;

    // Step 1: Compute centroid embedding from the note's chunks.
    // Average all chunk embeddings for this note into a single representative vector.
    const centroidRows = await this.db.execute(
      sql`
        SELECT
          (SELECT array_agg(x) FROM unnest(avg_arr) AS x) AS centroid
        FROM (
          SELECT
            array_agg(e ORDER BY ordinality)::float8[] AS avg_arr
          FROM (
            SELECT ordinality, avg(val) AS e
            FROM chunks c,
                 unnest(string_to_array(trim(c.embedding::text, '[]'), ',')::float8[]) WITH ORDINALITY AS t(val, ordinality)
            WHERE c.source_id = ${noteId}::uuid
              AND c.embedding IS NOT NULL
            GROUP BY ordinality
          ) sub
        ) sub2
      `,
    );

    const row = (centroidRows as unknown as { centroid: number[] | null }[])[0];
    if (!row?.centroid || row.centroid.length === 0) {
      return [];
    }

    const vectorLiteral = `[${row.centroid.join(',')}]`;

    // Step 2: Find already-linked note IDs (both outgoing links and incoming backlinks)
    const linkedRows = await this.db.execute(
      sql`
        SELECT DISTINCT target_source_id AS linked_id
        FROM source_links
        WHERE source_id = ${noteId}::uuid AND target_source_id IS NOT NULL
        UNION
        SELECT DISTINCT source_id AS linked_id
        FROM source_links
        WHERE target_source_id = ${noteId}::uuid
      `,
    );
    const linkedIds = new Set(
      (linkedRows as unknown as { linked_id: string }[]).map((r) => r.linked_id),
    );
    linkedIds.add(noteId); // exclude self

    // Step 3: Vector similarity search on note chunks, grouped by source
    const results = await this.db.execute(
      sql`
        SELECT
          c.source_id,
          s.title,
          s.filename,
          MAX(1 - (c.embedding <=> ${vectorLiteral}::vector)) AS score
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'ready'
          AND s.is_note = true
          AND c.embedding IS NOT NULL
          AND c.source_id != ${noteId}::uuid
        GROUP BY c.source_id, s.title, s.filename
        ORDER BY MAX(1 - (c.embedding <=> ${vectorLiteral}::vector)) DESC
        LIMIT ${(limit * 3) + linkedIds.size}
      `,
    );

    // Step 4: Filter out already-linked, below-threshold, and same-title notes.
    // Collect all passing rows first, then dedupe by title so that a
    // user-authored note and its wiki-generated copy don't both appear as
    // separate suggestions (the highest-scoring one is kept).
    const passing: Array<{ sourceId: string; title: string | null; filename: string; score: number }> = [];
    for (const r of results as unknown as {
      source_id: string;
      title: string | null;
      filename: string;
      score: number;
    }[]) {
      if (linkedIds.has(r.source_id)) continue;
      if (r.score < 0.3) continue;
      // Exclude notes whose title matches the current note (case-insensitive).
      // This prevents a generated wiki copy from appearing as a suggestion to
      // the source note (and vice versa).
      if (
        currentNoteTitleLower !== null &&
        r.title !== null &&
        r.title.toLowerCase() === currentNoteTitleLower
      ) {
        continue;
      }
      passing.push({
        sourceId: r.source_id,
        title: r.title,
        filename: r.filename,
        score: Math.round(r.score * 100) / 100,
      });
    }

    // Dedupe by lowercase title, keeping the highest-scoring row per title
    // (rows are already sorted descending by score from the SQL query).
    const deduped = dedupeByTitle(passing);

    return deduped.slice(0, limit);
  }
}
