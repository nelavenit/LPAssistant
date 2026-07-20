export function VariableName({ name }: { name: string }) {
  const match = /^(.*?)(\d+)$/.exec(name);
  if (!match) return <span className="variable-name">{name}</span>;
  // Keep the base and its index in one inline formatting context. A bare
  // fragment turns the subscript into a flex item in selectors and previews,
  // which makes browsers align it as a superscript or clip it entirely.
  return <span className="variable-name">{match[1]}<sub>{match[2]}</sub></span>;
}
