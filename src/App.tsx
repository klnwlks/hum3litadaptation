import { Game } from './engine/Game'
import { items } from './items'
import { levels } from './levels'

export default function App() {
  return <Game levels={levels} items={items} start="sample" />
}
