export default function SpacerBlock({ data = {} }) {
  const height = Number(data.height) || 24;
  return <div style={{ height: `${Math.min(Math.max(height, 0), 400)}px` }} />;
}
