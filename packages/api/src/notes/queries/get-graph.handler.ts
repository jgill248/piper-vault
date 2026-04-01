import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { GetGraphQuery } from './get-graph.query';
import { DATABASE } from '../../database/database.providers';
import type { Database } from '../../database/connection';

export interface GraphNode {
  readonly id: string;
  readonly title: string | null;
  readonly filename: string;
  readonly isNote: boolean;
  readonly linkCount: number;
  readonly backlinkCount: number;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly linkType: string;
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

@QueryHandler(GetGraphQuery)
export class GetGraphHandler implements IQueryHandler<GetGraphQuery> {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute(query: GetGraphQuery): Promise<GraphData> {
    const collectionFilter = query.collectionId
      ? sql`AND s.collection_id = ${query.collectionId}::uuid`
      : sql``;

    // Load all sources with link counts
    const nodeRows = await this.db.execute(
      sql`
        SELECT
          s.id,
          s.title,
          s.filename,
          s.is_note,
          COALESCE((SELECT count(*) FROM source_links sl WHERE sl.source_id = s.id), 0)::int AS link_count,
          COALESCE((SELECT count(*) FROM source_links sl WHERE sl.target_source_id = s.id), 0)::int AS backlink_count
        FROM sources s
        WHERE s.status = 'ready'
          ${collectionFilter}
        ORDER BY s.filename
      `,
    );

    const nodes = (nodeRows as unknown as {
      id: string;
      title: string | null;
      filename: string;
      is_note: boolean;
      link_count: number;
      backlink_count: number;
    }[]).map((r) => ({
      id: r.id,
      title: r.title,
      filename: r.filename,
      isNote: r.is_note,
      linkCount: r.link_count,
      backlinkCount: r.backlink_count,
    }));

    // Only include nodes that have at least one connection, plus all notes
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Load all edges where both endpoints exist
    const edgeRows = await this.db.execute(
      sql`
        SELECT sl.source_id, sl.target_source_id, sl.link_type
        FROM source_links sl
        WHERE sl.target_source_id IS NOT NULL
      `,
    );

    const edges = (edgeRows as unknown as {
      source_id: string;
      target_source_id: string;
      link_type: string;
    }[])
      .filter((r) => nodeIds.has(r.source_id) && nodeIds.has(r.target_source_id))
      .map((r) => ({
        source: r.source_id,
        target: r.target_source_id,
        linkType: r.link_type,
      }));

    // Filter to only nodes that have edges or are notes (skip orphan non-note sources)
    const connectedIds = new Set<string>();
    for (const e of edges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }
    const filteredNodes = nodes.filter((n) => n.isNote || connectedIds.has(n.id));

    return { nodes: filteredNodes, edges };
  }
}
