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
        className="font-label text-xs text-primary underline decoration-primary/30 underline-offset-2 cursor-pointer hover:decoration-primary transition-all inline"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="font-label text-xs text-on-surface-variant underline decoration-dashed decoration-on-surface-variant/30 underline-offset-2 cursor-default"
      title={`"${targetFilename}" does not exist yet`}
    >
      {label}
    </span>
  );
}
