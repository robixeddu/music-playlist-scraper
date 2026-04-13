interface PlaylistCoverProps {
  color: string;
  size?: number;
}

export default function PlaylistCover({ color, size = 40 }: PlaylistCoverProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.round(size * 0.1),
        flexShrink: 0,
      }}
    />
  );
}
