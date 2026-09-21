export const SLIDERS = [
  ['sensitivity', 'Mouse sensitivity', .2, 3, .1, 1],
  ['scopeSensitivity', 'Scope sensitivity', .1, 2, .05, .65],
  ['fov', 'Field of view', 65, 110, 1, 85],
  ['volume', 'Master volume', 0, 1, .05, .45],
  ['effectsVolume', 'Effects & gameplay', 0, 1, .05, .85],
  ['ambienceVolume', 'Ambience & wind', 0, 1, .05, .5],
  ['musicVolume', 'Music & fanfares', 0, 1, .05, .3],
];
export const SLIDER_DEFAULTS = Object.fromEntries(SLIDERS.map(([id,,,,,value]) => [id,value]));
export function resetSliders(settings, id = 'all') {
  for (const [key,value] of Object.entries(SLIDER_DEFAULTS))
    if (id === 'all' || id === key) settings[key] = value;
  return settings;
}
export function royalePanelAction(code, bindings, current = '') {
  if (current && !['royale-map','royale-inventory'].includes(current)) return null;
  const panel = bindings.map.includes(code) ? 'royale-map' : bindings.inventory.includes(code) ? 'royale-inventory' : null;
  return panel && (panel === current ? 'close' : panel);
}
