import { useEffect, useState } from 'react'
import { fullyRevealed, lineText, revealed, type Dialogue } from './dialogue'

export function DialogueBox({ dialogue }: { dialogue: Dialogue }) {
  const now = useTypewriterClock(dialogue)
  const line = dialogue.lines[dialogue.index]
  const speaker = typeof line === 'string' ? undefined : line.speaker
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-6">
      <div className="w-full max-w-3xl border-4 border-white bg-black p-4 font-mono text-lg leading-relaxed text-white">
        {speaker && <h2 className="mb-1 font-bold">{speaker}</h2>}
        <p>{lineText(line).slice(0, revealed(dialogue, now))}</p>
      </div>
    </div>
  )
}

/** Re-renders every animation frame until the current line is fully revealed. */
function useTypewriterClock(dialogue: Dialogue): number {
  const [now, setNow] = useState(() => performance.now())
  const running = !fullyRevealed(dialogue, now)
  useEffect(() => {
    if (!running) return
    let id = requestAnimationFrame(function tick(t) {
      setNow(t)
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [running])
  return now
}
