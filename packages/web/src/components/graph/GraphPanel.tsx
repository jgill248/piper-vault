import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { Maximize2, Network } from 'lucide-react';
import { useGraph } from '../../hooks/use-graph';
import { useActiveCollection } from '../../context/CollectionContext';
import { useNavigation } from '../../context/NavigationContext';

interface GraphNode {
  id: string;
  title: string | null;
  filename: string;
  isNote: boolean;
  linkCount: number;
  backlinkCount: number;
  x?: number;
  y?: number;
  // Pre-computed for hover highlight lookups
  neighbors?: Set<GraphNode>;
  links?: Set<GraphLink>;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  linkType: string;
}

export function GraphPanel() {
  const { activeCollectionId } = useActiveCollection();
  const { data, isLoading } = useGraph(activeCollectionId);
  const { navigateToNote } = useNavigation();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<GraphNode>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleFitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isNote) {
        navigateToNote(node.id);
      }
    },
    [navigateToNote],
  );

  // Read CSS custom properties for theming
  const getColor = useCallback((varName: string, fallback: string) => {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
  }, []);

  // Build graph data with neighbor/link lookup maps for hover highlighting
  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const nodes = data.nodes.map((n) => ({
      ...n,
      neighbors: new Set<GraphNode>(),
      links: new Set<GraphLink>(),
    })) as GraphNode[];

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links = data.edges.map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
    })) as GraphLink[];

    // Pre-compute neighbor sets for hover highlighting
    for (const link of links) {
      const srcId = typeof link.source === 'string' ? link.source : link.source.id;
      const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
      const srcNode = nodeById.get(srcId);
      const tgtNode = nodeById.get(tgtId);
      if (srcNode && tgtNode) {
        srcNode.neighbors!.add(tgtNode);
        tgtNode.neighbors!.add(srcNode);
        srcNode.links!.add(link);
        tgtNode.links!.add(link);
      }
    }

    return { nodes, links };
  }, [data]);

  // Handle node hover — update highlight sets
  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      const newHighlightNodes = new Set<GraphNode>();
      const newHighlightLinks = new Set<GraphLink>();
      if (node) {
        newHighlightNodes.add(node);
        node.neighbors?.forEach((neighbor) => newHighlightNodes.add(neighbor));
        node.links?.forEach((link) => newHighlightLinks.add(link));
      }
      setHoverNode(node);
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    },
    [],
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const connections = node.linkCount + node.backlinkCount;
      const isIsolated = connections === 0;
      const isHighlighted = highlightNodes.has(node);
      const isHovered = node === hoverNode;
      const hasHover = hoverNode !== null;

      // Scale node size: isolated nodes are smaller, hovered nodes slightly larger
      let radius = Math.max(3, Math.min(12, 3 + connections * 1.5));
      if (isIsolated) radius = 2.5;
      if (isHovered) radius *= 1.3;

      // Determine node opacity — dim non-highlighted nodes when hovering
      const dimmed = hasHover && !isHighlighted;
      const alpha = dimmed ? 0.15 : isIsolated ? 0.4 : 1;

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
      ctx.globalAlpha = alpha;

      if (isIsolated) {
        // Isolated nodes: dashed outline, no fill
        ctx.strokeStyle = getColor('--color-on-surface-variant', '#897172');
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = node.isNote
          ? getColor('--color-primary', '#570013')
          : getColor('--color-secondary', '#4f6073');
        ctx.fill();
      }

      // Hover ring
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI, false);
        ctx.strokeStyle = getColor('--color-primary', '#570013');
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
      }

      // Label — always visible, scales with zoom
      const label = node.title || node.filename.replace(/\.md$/, '');
      const baseFontSize = isHovered ? 14 : 12;
      const fontSize = Math.max(9, baseFontSize / globalScale);
      ctx.font = `${fontSize}px "Newsreader", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = dimmed ? 0.15 : isIsolated ? 0.35 : 0.9;
      ctx.fillStyle = getColor('--color-on-surface', '#1d1c15');
      ctx.fillText(label, x, y + radius + 2);

      // Reset alpha
      ctx.globalAlpha = 1;
    },
    [getColor, hoverNode, highlightNodes],
  );

  // Empty state
  if (!isLoading && graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 select-none px-4">
        <div className="border border-primary/20 p-6 bg-surface/50">
          <Network size={32} className="text-primary/40" strokeWidth={1} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-headline font-semibold text-on-surface text-sm">No connections yet</p>
          <p className="font-body text-[12px] text-on-surface-variant max-w-sm">
            Create notes with [[wiki-links]] to build your knowledge graph.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">
          Loading graph...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface-container shrink-0">
        <div>
          <h1 className="font-headline font-semibold text-on-surface text-sm">Knowledge Graph</h1>
          <p className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest mt-0.5">
            {graphData.nodes.length} NODES / {graphData.links.length} CONNECTIONS
          </p>
        </div>
        <button
          onClick={handleFitView}
          className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5"
          title="Fit graph to view"
        >
          <Maximize2 size={10} strokeWidth={2} />
          FIT_
        </button>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 bg-background">
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: GraphNode, color, ctx) => {
            const connections = node.linkCount + node.backlinkCount;
            const radius = Math.max(3, Math.min(12, 3 + connections * 1.5));
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, radius + 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={(link: GraphLink) => {
            if (hoverNode && !highlightLinks.has(link)) {
              return getColor('--color-secondary', '#4f6073') + '15';
            }
            if (highlightLinks.has(link)) {
              return getColor('--color-primary', '#570013');
            }
            return getColor('--color-secondary', '#4f6073');
          }}
          linkWidth={(link: GraphLink) => (highlightLinks.has(link) ? 3 : 1.5)}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          autoPauseRedraw={false}
          cooldownTicks={100}
          warmupTicks={50}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      </div>
    </div>
  );
}
