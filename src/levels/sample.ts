import { door, flag, has, pickup } from '../engine/helpers'
import { defineLevel } from '../engine/level'

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.'

export const sample = defineLevel({
  id: 'sample',
  map: [
    '################',
    '#......#.......#',
    '#......#.......#',
    '#......#.......#',
    '#..............#',
    '#......#.......#',
    '###.####.......#',
    '#......#.......#',
    '#......#.......#',
    '################',
  ],
  tiles: {
    '#': { color: '#3a3a3a', solid: true },
    '.': { color: '#141414' },
  },
  spawn: { x: 3, y: 3 },
  enter: [LOREM],
  // Dim room lit by the player; darker still once 'dolor' is set.
  lighting: (s) => ({ ambient: s.flags.dolor ? 0.04 : 0.15, player: { radius: 4 } }),
  things: [
    // Plain: same lines every time, with speakers.
    {
      id: 'a',
      at: { x: 1, y: 1 },
      color: '#7a1f1f',
      lines: [{ speaker: 'Lorem', text: LOREM }, LOREM, { speaker: 'Ipsum', text: LOREM }],
    },
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
      opened: [LOREM, LOREM],
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
    // Drawn from an image; `color` shows until it loads.
    { id: 'f', at: { x: 12, y: 3 }, color: '#444444', image: '/favicon.svg', lines: [LOREM] },
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
