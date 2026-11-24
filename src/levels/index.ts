import type { Level } from '../engine/types'
import { sample } from './sample'

/** Every level `goto` can reach, by id. */
export const levels: Record<string, Level> = {
  [sample.id]: sample,
}
