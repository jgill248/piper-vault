import { useRef, useCallback, useEffect, useState } from 'react';
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

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const connections = node.linkCount + node.backlinkCount;
      const radius = Math.max(3, Math.min(12, 3 + connections * 1.5));

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.isNote
        ? getColor('--color-primary', '#570013')
        : getColor('--color-secondary', '#4f6073');
      ctx.fill();

      // Label (show only when zoomed in enough)
      if (globalScale > 1.2) {
        const label = node.title || node.filename.replace(/\.md$/, '');
        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `${fontSize}px "Newsreader", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = getColor('--color-on-surface', '#1d1c15');
        ctx.fillText(label, x, y + radius + 2);
      }
    },
    [getColor],
  );

  const graphData = data
    ? {
        nodes: data.nodes.map((n) => ({ ...n })) as GraphNode[],
        links: data.edges.map((e) => ({ ...e, source: e.source, target: e.target })) as GraphLink[],
      }
    : { nodes: [] as GraphNode[], links: [] as GraphLink[] };

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
            ctx.arc(node.x ?? 0, node.y ?? 0, radius + 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={() => getColor('--color-outline-variant', '#897172') + '60'}
          linkWidth={0.5}
          onNodeClick={handleNodeClick}
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
