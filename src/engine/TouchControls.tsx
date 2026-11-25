import type { PointerEvent, ReactNode } from 'react'

// Synthesizes the same key events the keyboard handlers already consume.
function press(code: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }))
}

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'size-2/3' } as const

function Button({ code, label, children, className }: { code: string; label: string; children?: ReactNode; className?: string }) {
  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    press(code, 'keydown')
  }
  const up = () => press(code, 'keyup')
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex size-16 touch-none items-center justify-center border-4 border-white/70 bg-black/50 font-mono text-xl text-white select-none active:bg-white/40 ${className ?? ''}`}
    >
      {children ?? label}
    </button>
  )
}

export function TouchControls() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 hidden items-end justify-between p-4 pointer-coarse:flex">
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        <Button code="ArrowUp" label="▲" className="col-start-2 row-start-1" />
        <Button code="ArrowLeft" label="◀" className="col-start-1 row-start-2" />
        <Button code="ArrowRight" label="▶" className="col-start-3 row-start-2" />
        <Button code="ArrowDown" label="▼" className="col-start-2 row-start-3" />
      </div>
      <div className="flex flex-col items-end gap-3">
        <Button code="KeyQ" label="Toggle view" className="size-12">
          <svg viewBox="0 0 24 24" {...icon}>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Button>
        <Button code="KeyE" label="Interact" className="size-20 rounded-full">
          <svg viewBox="0 0 24 24" {...icon}>
            <path d="M9 11V5a2 2 0 0 1 4 0v5m0 0V8a2 2 0 0 1 4 0v4m0 0a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-2a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.5-2L9 15" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
