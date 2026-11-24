import { door, flag, has, pickup } from '../engine/helpers'
import { defineLevel } from '../engine/level'

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.'

export const sample = defineLevel({
  id: 'sample',
  map: [
    '####X###########',
    '#......#.......#',
    '#......#.......#',
    '#......#.......#',
    '#..r...........#',
    '#......#.......#',
    '###.####.......#',
    '#......#.......#',
    '#......#.......#',
    '################',
  ],
  tiles: {
    '#': { color: '#3a3a3a', solid: true },
    '.': { color: '#141414' },
    // Wall whose south side carries an image; only seen in 3D, from inside the left room.
    X: { color: '#3a3a3a', solid: true, faces: { s: { color: '#5a0f0f', image: '/favicon.svg' } } },
    // Floor with a different ceiling above it; only seen in 3D.
    r: { color: '#141414', ceiling: { color: '#4a0a0a' } },
  },
  ceiling: { color: '#0d0d10', height: 1.5 },
  // Sound files are not included: drop them in public/sounds/ (missing ones stay silent).
  ambience: { src: '/sounds/lorem-ambience.ogg', volume: 0.4 },
  spawn: { x: 3, y: 3 },
  enter: [LOREM],
  // Dim room lit by the player; darker in 3D, darker still once 'dolor' is set.
  lighting: (s) => ({ ambient: s.flags.dolor ? 0.04 : s.view === '3d' ? 0.08 : 0.15, player: { radius: 4 } }),
  // Constant film look; heavier distortion once 'dolor' is set.
  effects: (s) => ({
    vignette: 0.7,
    grain: 0.25,
    scanlines: 0.2,
    aberration: s.flags.dolor ? 1 : 0.15,
    wobble: s.flags.dolor ? 1 : 0,
  }),
  things: [
    // Plain: same lines every time, with speakers.
    {
      id: 'a',
      at: { x: 1, y: 1 },
      color: '#7a1f1f',
      lines: [{ speaker: 'Lorem', text: LOREM }, LOREM, { speaker: 'Ipsum', text: LOREM }],
      after: ({ play }) => play('/sounds/lorem-after.ogg'),
    },
    // Tall in 3D; from above, just a square. Says something else when looked at in 3D.
    {
      id: 'tall',
      at: { x: 6, y: 1 },
      color: '#202020',
      height: 1.4,
      lines: (s) =>
        s.view === '3d' ? [{ speaker: 'Ipsum', portrait: '/favicon.svg', sound: '/sounds/lorem-sting.ogg', text: LOREM }] : [LOREM],
    },
    // Hangs from the ceiling; exists only in 3D. Non-solid: stand under it and interact.
    {
      id: 'hanging',
      at: { x: 2, y: 3 },
      color: '#6a6a50',
      elevation: 1.05,
      height: 0.4,
      solid: false,
      shown: (s) => s.view === '3d',
      lines: [LOREM],
    },
    // Exists only in top-down.
    { id: 'flat', at: { x: 5, y: 2 }, color: '#2a4a2a', solid: false, shown: (s) => s.view === 'top', lines: [LOREM] },
    // Gives item 'lorem', which opens the door.
    pickup({
      id: 'sample.key',
      item: 'lorem',
      at: { x: 5, y: 7 },
      color: '#c0a040',
      light: { color: '#c0a040', radius: 2, intensity: 0.6 },
      lines: [LOREM],
    }),
    door({
      id: 'sample.door',
      key: 'lorem',
      at: { x: 7, y: 4 },
      color: '#5a3a1a',
      lines: [LOREM],
      opened: [{ text: LOREM, sound: '/sounds/lorem-door.ogg' }, LOREM],
    }),
    // Wide, multi-tile.
    { id: 'b', at: { x: 9, y: 1 }, size: { x: 3, y: 1 }, color: '#1f3f7a', lines: [LOREM, LOREM] },
    // Says something else on repeat visits; reading it reveals 'c'.
    {
      id: 'b2',
      at: { x: 13, y: 7 },
      color: '#7a6a1f',
      lines: (s) => (s.flags.readB2 ? [LOREM] : [LOREM, LOREM, LOREM, LOREM]),
      after: ({ set }) => set('readB2', true),
      // Flickers until read, then goes out.
      light: (s) => (s.flags.readB2 ? undefined : { color: '#ffd080', radius: 5, flicker: 0.6 }),
      // Hums while lit; goes quiet with the light.
      sound: (s) => (s.flags.readB2 ? undefined : { src: '/sounds/lorem-hum.ogg', radius: 6 }),
    },
    // Only exists once 'b2' has been read; gives item 'ipsum'.
    pickup({ id: 'sample.c', item: 'ipsum', at: { x: 10, y: 5 }, color: '#5a1f7a', shown: flag('readB2'), lines: [LOREM] }),
    // Choices; the last one needs item 'ipsum' and sets 'dolor'.
    {
      id: 'e',
      at: { x: 9, y: 7 },
      color: '#7a1f5a',
      lines: [
        LOREM,
        {
          speaker: 'Lorem',
          text: LOREM,
          choices: [
            { text: 'Lorem ipsum', lines: [LOREM] },
            { text: 'Dolor sit', lines: [{ speaker: 'Ipsum', text: LOREM }, LOREM] },
            { text: 'Amet consectetur', requires: has('ipsum'), lines: [LOREM], after: ({ set }) => set('dolor', true) },
          ],
        },
      ],
    },
    // Drawn from an image: flat from above, an upright camera-facing sprite in 3D.
    { id: 'f', at: { x: 5, y: 4 }, color: '#444444', image: '/favicon.svg', height: 0.8, lines: [LOREM] },
    // Non-solid floor marker: stand on it and interact to be moved elsewhere.
    {
      id: 'd',
      at: { x: 14, y: 8 },
      color: '#1f6a3a',
      solid: false,
      lines: [LOREM],
      after: ({ goto }) => goto('sample', { x: 1, y: 3 }),
    },
  ],
})
