export function VariableName({ name }: { name: string }) {
  const match = /^(.*?)(\d+)$/.exec(name);
  if (!match) return <>{name}</>;
  return <>{match[1]}<sub>{match[2]}</sub></>;
}
