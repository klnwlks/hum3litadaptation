import type { Item } from './types'

/** Held items as a row of swatches (or their images), top-left. */
export function Inventory({ held, items }: { held: ReadonlySet<string>; items: Record<string, Item> }) {
  return (
    <ul className="pointer-events-none absolute top-4 left-4 flex gap-2">
      {[...held].map((id) => (
        <li key={id} className="size-8 border-2 border-white" style={{ backgroundColor: items[id].color }}>
          {items[id].image && <img src={items[id].image} alt="" className="size-full object-contain [image-rendering:pixelated]" />}
        </li>
      ))}
    </ul>
  )
}
