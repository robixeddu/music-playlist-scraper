interface PlaylistCoverProps {
  gradient: [string, string];
  size?: number;
}

export default function PlaylistCover({ gradient, size = 40 }: PlaylistCoverProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})`,
        borderRadius: Math.round(size * 0.1),
        flexShrink: 0,
      }}
    />
  );
}
