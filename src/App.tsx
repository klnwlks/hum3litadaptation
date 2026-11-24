import { Game } from './engine/Game'
import { levels } from './levels'

export default function App() {
  return <Game levels={levels} start="sample" />
}
