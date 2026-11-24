import { useEffect, useState } from 'react'
import { fullyRevealed, lineText, revealed, type Dialogue } from './dialogue'
import type { Choice } from './types'

/** `choices` are the current line's visible choices; shown once the line finishes typing. */
export function DialogueBox({ dialogue, choices }: { dialogue: Dialogue; choices: Choice[] }) {
  const now = useTypewriterClock(dialogue)
  const line = dialogue.lines[dialogue.index]
  const speaker = typeof line === 'string' ? undefined : line.speaker
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-6">
      <div className="w-full max-w-3xl border-4 border-white bg-black p-4 font-mono text-lg leading-relaxed text-white">
        {speaker && <h2 className="mb-1 font-bold">{speaker}</h2>}
        <p>{lineText(line).slice(0, revealed(dialogue, now))}</p>
        {fullyRevealed(dialogue, now) && choices.length > 0 && (
          <ul className="mt-3">
            {choices.map((c, i) => (
              <li key={c.text} className={i === dialogue.choice ? 'bg-white px-2 text-black' : 'px-2'}>
                {c.text}
              </li>
            ))}
          </ul>
        )}
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
