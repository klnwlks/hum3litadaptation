import { door, flag, has, pickup } from '../engine/helpers'
import { defineLevel } from '../engine/level'

const SAMPLE = 'sample dialogue test'
const STEP = '/sounds/lorem-step.ogg'

// Placeholder frames: plain colored squares.
const square = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`)}`

export const sample = defineLevel({
  id: 'sample',
  map: [
    '####X###########',
    '#......#.......#',
    '#..p...#.......#',
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
    '.': { color: '#141414', step: STEP },
    X: { color: '#3a3a3a', solid: true, faces: { s: { color: '#5a0f0f', image: ['/favicon.svg', square('#5a0f0f')], fps: 2 } } },
    p: { color: '#141414', step: STEP, image: [square('#141414'), square('#3a0a0a'), square('#141414'), square('#0a0a3a')], fps: 3 },
    r: { color: '#141414', step: STEP, ceiling: { color: '#4a0a0a', image: '/favicon.svg' } },
  },
  ceiling: { color: '#0d0d10', height: 1.5 },
  // Sound files aren't shipped; missing ones stay silent.
  ambience: { src: '/sounds/lorem-ambience.ogg', volume: 0.4 },
  spawn: { x: 3, y: 3 },
  enter: [SAMPLE],
  lighting: (s) => ({ ambient: s.flags.dolor ? 0.04 : s.view === '3d' ? 0.08 : 0.15, player: { radius: 4 } }),
  fog: (s) => ({ distance: s.view === '3d' ? 6.5 : 11 }),
  effects: (s) => ({
    vignette: 0.7,
    grain: 0.25,
    scanlines: 0.2,
    dither: 0.6,
    aberration: s.flags.dolor ? 1 : 0.15,
    wobble: s.flags.dolor ? 1 : 0,
  }),
  triggers: [
    {
      at: { x: 3, y: 6 },
      when: (s) => !s.flags.crossed,
      enter: ({ set, say, wait }) => {
        set('crossed', true)
        say(['sample step trigger test'])
        wait(5, (ctx) => ctx.say([{ speaker: 'Ipsum', text: 'sample timer dialogue test' }]))
      },
    },
    {
      at: { x: 1, y: 8 },
      when: (s) => !s.flags.forcedView,
      enter: ({ set, view, say }) => {
        set('forcedView', true)
        view('3d')
        say(['sample forced perspective test'])
      },
    },
    {
      at: { x: 6, y: 8 },
      when: (s) => !s.flags.fullShown,
      enter: ({ set, say, image, flash }) => {
        set('fullShown', true)
        flash('#ffffff', 3)
        image('/favicon.svg', 3)
        say([{ speaker: 'Ipsum', image: '/favicon.svg', full: true, text: 'sample full image dialogue test' }])
      },
    },
  ],
  things: [
    {
      id: 'a',
      at: { x: 1, y: 1 },
      color: '#7a1f1f',
      lines: [{ speaker: 'Lorem', text: SAMPLE }, SAMPLE, { speaker: 'Ipsum', text: SAMPLE }],
      after: ({ play }) => play('/sounds/lorem-after.ogg'),
    },
    {
      id: 'tall',
      at: { x: 6, y: 1 },
      color: '#202020',
      height: 1.4,
      lines: (s) =>
        s.view === '3d' ? [{ speaker: 'Ipsum', portrait: '/favicon.svg', sound: '/sounds/lorem-sting.ogg', text: SAMPLE }] : [SAMPLE],
    },
    {
      id: 'hanging',
      at: { x: 2, y: 3 },
      color: '#6a6a50',
      elevation: 1.05,
      height: 0.4,
      solid: false,
      shown: (s) => s.view === '3d',
      lines: [SAMPLE],
    },
    { id: 'flat', at: { x: 5, y: 2 }, color: '#2a4a2a', solid: false, shown: (s) => s.view === 'top', lines: [SAMPLE] },
    pickup({
      id: 'sample.key',
      item: 'lorem',
      at: { x: 5, y: 7 },
      color: '#c0a040',
      light: { color: '#c0a040', radius: 2, intensity: 0.6, blink: 0.5 },
      lines: [SAMPLE],
    }),
    door({
      id: 'sample.door',
      key: 'lorem',
      at: { x: 7, y: 4 },
      color: '#5a3a1a',
      lines: [SAMPLE],
      opened: [{ text: SAMPLE, sound: '/sounds/lorem-door.ogg' }, SAMPLE],
    }),
    { id: 'b', at: { x: 9, y: 1 }, size: { x: 3, y: 1 }, color: '#1f3f7a', lines: [SAMPLE, SAMPLE] },
    {
      id: 'b2',
      at: { x: 13, y: 7 },
      color: '#7a6a1f',
      lines: (s) => (s.flags.readB2 ? [SAMPLE] : [SAMPLE, SAMPLE, SAMPLE, SAMPLE]),
      after: ({ set }) => set('readB2', true),
      light: (s) => (s.flags.readB2 ? undefined : { color: '#ffd080', radius: 5, flicker: 0.6 }),
      sound: (s) => (s.flags.readB2 ? undefined : { src: '/sounds/lorem-hum.ogg', radius: 6 }),
    },
    pickup({ id: 'sample.c', item: 'ipsum', at: { x: 10, y: 5 }, color: '#5a1f7a', shown: flag('readB2'), lines: [SAMPLE] }),
    {
      id: 'e',
      at: { x: 9, y: 7 },
      color: '#7a1f5a',
      lines: [
        SAMPLE,
        {
          speaker: 'Lorem',
          text: SAMPLE,
          choices: [
            { text: 'Lorem ipsum', lines: [SAMPLE] },
            { text: 'Dolor sit', lines: [{ speaker: 'Ipsum', text: SAMPLE }, SAMPLE] },
            { text: 'Amet consectetur', requires: has('ipsum'), lines: [SAMPLE], after: ({ set }) => set('dolor', true) },
          ],
        },
      ],
    },
    {
      id: 'f',
      at: { x: 5, y: 4 },
      color: '#444444',
      image: '/favicon.svg',
      blink: 1,
      height: 0.8,
      lines: [{ speaker: 'Ipsum', image: '/favicon.svg', text: 'sample image dialogue test' }],
    },
    {
      id: 'patrol',
      at: { x: 9, y: 3 },
      color: '#8a8a8a',
      height: 0.6,
      patrol: { every: 1, to: [{ x: 10, y: 3 }, { x: 11, y: 3 }, { x: 11, y: 4 }] },
      lines: [SAMPLE],
    },
    {
      id: 'd',
      at: { x: 14, y: 8 },
      color: '#1f6a3a',
      solid: false,
      lines: [SAMPLE],
      after: ({ goto }) => goto('sample', { x: 1, y: 3 }),
    },
  ],
})
