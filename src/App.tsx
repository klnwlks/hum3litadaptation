import { Canvas } from '@react-three/fiber'

export default function App() {
  return (
    <div className="h-screen w-screen bg-neutral-900">
      <Canvas>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} />
        <mesh rotation={[0.4, 0.6, 0]}>
          <boxGeometry />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </Canvas>
    </div>
  )
}
