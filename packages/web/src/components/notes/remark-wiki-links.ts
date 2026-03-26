import { visit } from 'unist-util-visit';
import { parseWikiLinks } from '@delve/shared';
import type { Root, Text, PhrasingContent } from 'mdast';

interface WikiLinkNode {
  type: 'wikiLink';
  data: {
    hName: string;
    hProperties: {
      targetFilename: string;
      displayText: string | null;
      section: string | null;
      linkType: string;
    };
  };
  children: Array<{ type: 'text'; value: string }>;
}

function createWikiLinkNode(
  targetFilename: string,
  displayText: string | null,
  section: string | null,
  linkType: string,
): WikiLinkNode {
  // Determine display label
  let label: string;
  if (displayText) {
    label = displayText;
  } else if (section) {
    label = `${targetFilename} > ${section}`;
  } else {
    label = targetFilename;
  }

  return {
    type: 'wikiLink',
    data: {
      hName: 'wiki-link',
      hProperties: {
        targetFilename,
        displayText,
        section,
        linkType,
      },
    },
    children: [{ type: 'text', value: label }],
  };
}

/**
 * Remark plugin that transforms [[wiki-link]] syntax into custom wikiLink
 * MDAST nodes, which ReactMarkdown can render via the components prop.
 */
export function remarkWikiLinks() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      const links = parseWikiLinks(node.value);
      if (links.length === 0) return;

      // Split the text node around wiki-links
      const newNodes: PhrasingContent[] = [];
      let lastEnd = 0;

      for (const link of links) {
        // Text before this link
        if (link.position.start > lastEnd) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastEnd, link.position.start),
          });
        }

        // The wiki-link node
        newNodes.push(
          createWikiLinkNode(
            link.targetFilename,
            link.displayText,
            link.section,
            link.linkType,
          ) as unknown as PhrasingContent,
        );

        lastEnd = link.position.end;
      }

      // Text after the last link
      if (lastEnd < node.value.length) {
        newNodes.push({
          type: 'text',
          value: node.value.slice(lastEnd),
        });
      }

      // Replace the original text node with the split nodes
      parent.children.splice(index, 1, ...newNodes);
    });
  };
}
