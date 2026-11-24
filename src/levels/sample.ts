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
  things: [
    // Plain: same lines every time.
    { id: 'a', at: { x: 1, y: 1 }, color: '#7a1f1f', lines: [LOREM, LOREM, LOREM] },
    // Wide, multi-tile.
    { id: 'b', at: { x: 9, y: 1 }, size: { x: 3, y: 1 }, color: '#1f3f7a', lines: [LOREM, LOREM] },
    // Says something else on repeat visits; reading it reveals 'c'.
    {
      id: 'b2',
      at: { x: 13, y: 7 },
      color: '#7a6a1f',
      lines: (flags) => (flags.readB2 ? [LOREM] : [LOREM, LOREM, LOREM, LOREM]),
      after: ({ set }) => set('readB2', true),
    },
    // Only exists once 'b2' has been read.
    { id: 'c', at: { x: 10, y: 5 }, color: '#5a1f7a', shown: (flags) => flags.readB2 === true, lines: [LOREM] },
    // Non-solid floor marker: stand on it and interact to be moved elsewhere.
    {
      id: 'd',
      at: { x: 2, y: 8 },
      color: '#1f6a3a',
      solid: false,
      lines: [LOREM],
      after: ({ goto }) => goto('sample', { x: 14, y: 1 }),
    },
  ],
})
