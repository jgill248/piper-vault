interface WikiLinkProps {
  readonly targetFilename: string;
  readonly displayText: string | null;
  readonly section: string | null;
  readonly resolved: boolean;
  readonly onClick?: () => void;
}

export function WikiLink({
  targetFilename,
  displayText,
  section,
  resolved,
  onClick,
}: WikiLinkProps) {
  let label: string;
  if (displayText) {
    label = displayText;
  } else if (section) {
    label = `${targetFilename} > ${section}`;
  } else {
    label = targetFilename;
  }

  if (resolved) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="font-mono text-xs text-phosphor underline decoration-phosphor/30 underline-offset-2 cursor-pointer hover:decoration-phosphor transition-all inline"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textShadow = '0 0 6px rgba(171,214,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textShadow = 'none';
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="font-mono text-xs text-ui-dim underline decoration-dashed decoration-ui-dim/30 underline-offset-2 cursor-default"
      title={`"${targetFilename}" does not exist yet`}
    >
      {label}
    </span>
  );
}
