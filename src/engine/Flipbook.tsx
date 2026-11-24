import { useEffect, useState } from 'react'
import { DEFAULT_FPS } from './material'
import type { Frames } from './types'

export function Flipbook({ frames, fps = DEFAULT_FPS, className }: { frames: Frames; fps?: number; className: string }) {
  const list = [frames].flat()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (list.length < 2) return
    const id = setInterval(() => setTick((t) => t + 1), 1000 / fps)
    return () => clearInterval(id)
  }, [list.length, fps])
  return <img src={list[tick % list.length]} alt="" className={className} />
}
