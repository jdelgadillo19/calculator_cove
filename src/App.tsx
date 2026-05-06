import { Navigate, Route, Routes } from 'react-router-dom'
import { GameScreen } from './pages/GameScreen'
import { MenuScreen } from './pages/MenuScreen'
import { StatsScreen } from './pages/StatsScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MenuScreen />} />
      <Route path="/play" element={<GameScreen />} />
      <Route path="/stats" element={<StatsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
