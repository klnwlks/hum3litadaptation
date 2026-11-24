import { Flipbook } from './Flipbook'
import type { Item } from './types'

export function Inventory({ held, items }: { held: ReadonlySet<string>; items: Record<string, Item> }) {
  return (
    <ul className="pointer-events-none absolute top-4 left-4 flex gap-2">
      {[...held].map((id) => (
        <li key={id} className="size-8 border-2 border-white" style={{ backgroundColor: items[id].color }}>
          {items[id].image && (
            <Flipbook frames={items[id].image} fps={items[id].fps} className="size-full object-contain [image-rendering:pixelated]" />
          )}
        </li>
      ))}
    </ul>
  )
}
