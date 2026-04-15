import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicHomePage from './pages/PublicHomePage'
import OrderPage from './pages/OrderPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import { supabase } from './lib/supabase'

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        setIsLoggedIn(false)
        setAuthChecked(true)
        return
      }

      setIsLoggedIn(!!data.session)
      setAuthChecked(true)
    }

    loadSession()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setIsLoggedIn(!!session)
      setAuthChecked(true)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (!authChecked) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
          fontSize: 20,
          color: '#475569',
        }}
      >
        Načítavam...
      </main>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/objednavka" element={<OrderPage />} />

        <Route
          path="/admin/login"
          element={isLoggedIn ? <Navigate to="/admin" replace /> : <AdminLoginPage />}
        />

        <Route
          path="/admin"
          element={isLoggedIn ? <AdminDashboardPage /> : <Navigate to="/admin/login" replace />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}