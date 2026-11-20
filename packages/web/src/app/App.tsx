import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { Spinner } from '../components/Card'
import { HomeScreen } from '../features/globe/HomeScreen'
import { useReport } from '../state/report'

import { Shell } from './Shell'

const FlowScreen = lazy(() => import('../features/flow/FlowScreen'))
const ChartsScreen = lazy(() => import('../features/charts/ChartsScreen'))
const CompareScreen = lazy(() => import('../features/compare/CompareScreen'))
const GuideScreen = lazy(() => import('../features/guide/GuideScreen'))
const LiveScreen = lazy(() => import('../features/live/LiveScreen'))
const AiSettings = lazy(() => import('../features/settings/AiSettings'))
const FixSettings = lazy(() => import('../features/settings/FixSettings'))
const DisplaySettings = lazy(() => import('../features/settings/DisplaySettings'))

export function App() {
  const load = useReport((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])

  return (
    <Shell>
      <Suspense
        fallback={
          <div className="page">
            <Spinner label="Loading screen" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/issues/:id" element={<HomeScreen />} />
          <Route path="/flow/*" element={<FlowScreen />} />
          <Route path="/charts" element={<Navigate to="/charts/overview" replace />} />
          <Route path="/charts/:tab" element={<ChartsScreen />} />
          <Route path="/compare" element={<CompareScreen />} />
          <Route path="/compare/:a/:b" element={<CompareScreen />} />
          <Route path="/guide" element={<GuideScreen />} />
          <Route path="/guide/:topic" element={<GuideScreen />} />
          <Route path="/live" element={<LiveScreen />} />
          <Route path="/settings/ai" element={<AiSettings />} />
          <Route path="/settings/fix" element={<FixSettings />} />
          <Route path="/settings/display" element={<DisplaySettings />} />
          <Route path="/settings" element={<Navigate to="/settings/ai" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  )
}
