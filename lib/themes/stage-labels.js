// The texts the theme stage needs, read on the server and handed to the (client) stage as plain strings.
// This lives outside the stage file on purpose: a function defined in a client file cannot be called from a server page.
export function stageLabels(t) {
  const keys = ['controls', 'quality', 'auto', 'low', 'medium', 'high', 'ultra', 'using', 'effects', 'animations'];
  // `using` keeps its {profile} placeholder: the stage fills it in, so it is read raw
  return Object.fromEntries(keys.map((k) => [k, k === 'using' ? t.raw(`controls.${k}`) : t(`controls.${k}`)]));
}
