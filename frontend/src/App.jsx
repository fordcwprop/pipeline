import React, { useState, useEffect } from 'react'
import { api } from './api'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import DealDetail from './pages/DealDetail'
import NewDeal from './pages/NewDeal'
import Strategies from './pages/Strategies'
import Underwriting from './pages/Underwriting'

function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedDealId, setSelectedDealId] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser({ email: 'unknown', role: 'viewer' }))
  }, [])

  const navigateToDeal = (dealId) => {
    setSelectedDealId(dealId)
    setPage('deal-detail')
  }

  const navigateBack = () => {
    setSelectedDealId(null)
    setPage('pipeline')
  }

  // Keyboard shortcuts
  useEffect(() => {
    let prefix = false
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === 'g') { prefix = true; setTimeout(() => prefix = false, 500); return }
      if (prefix) {
        prefix = false
        if (e.key === 'd') setPage('dashboard')
        if (e.key === 'p') setPage('pipeline')
        if (e.key === 'n') setPage('new-deal')
        if (e.key === 's') setPage('strategies')
        if (e.key === 'u') setPage('underwriting')
      }
      if (e.key === 'Escape') navigateBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigateToDeal={navigateToDeal} onNavigate={setPage} />
      case 'pipeline':
        return <Pipeline onNavigateToDeal={navigateToDeal} />
      case 'deal-detail':
        return <DealDetail dealId={selectedDealId} onBack={navigateBack} />
      case 'new-deal':
        return <NewDeal onCreated={(id) => { navigateToDeal(id) }} onCancel={() => setPage('pipeline')} />
      case 'strategies':
        return <Strategies />
      case 'underwriting':
        return <Underwriting />
      default:
        return <Dashboard onNavigateToDeal={navigateToDeal} onNavigate={setPage} />
    }
  }

  return (
    <Layout currentPage={page} onNavigate={setPage} user={user}>
      {renderPage()}
    </Layout>
  )
}

export default App
