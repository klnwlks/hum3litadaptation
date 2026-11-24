import type { Level } from '../engine/types'
import { sample } from './sample'

export const levels: Record<string, Level> = {
  [sample.id]: sample,
}
