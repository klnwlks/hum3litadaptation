export function DialogueBox({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-6">
      <p className="w-full max-w-3xl border-4 border-white bg-black p-4 font-mono text-lg leading-relaxed text-white">
        {text}
      </p>
    </div>
  )
}
