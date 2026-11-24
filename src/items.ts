import type { Item } from './engine/types'

/** Every item `give` accepts, by id. */
export const items: Record<string, Item> = {
  lorem: { color: '#c0a040' },
  ipsum: { color: '#40a0c0' },
}
