const SCENE_SRC = { coast: '/scenes/coast.svg', dusk: '/scenes/dusk.svg', skyline: '/scenes/skyline.svg', miami: '/scenes/miami.svg' };

export function SvgScene({ kind }) {
  const scene_src = SCENE_SRC[kind];
  if (!scene_src) return null;
  return <img src={scene_src} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right-bottom" />;
}
