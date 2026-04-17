import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicHomePage from './pages/PublicHomePage'
import OrderPage from './pages/OrderPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminAccommodationSettingsPage from './pages/AdminAccommodationSettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import Pricelist2026Page from './pages/Pricelist2026Page'
import { supabase } from './lib/supabase'
import { isUserAdmin } from './lib/adminAccess'

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function refreshFromSession(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      if (!isMounted) return

      if (!session) {
        setIsAdmin(false)
        setAuthChecked(true)
        return
      }

      const admin = await isUserAdmin(session.user.id)

      if (!isMounted) return

      setIsAdmin(admin)
      setAuthChecked(true)
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        setIsAdmin(false)
        setAuthChecked(true)
        return
      }

      await refreshFromSession(data.session)
    }

    loadSession()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void refreshFromSession(session)
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
				<Route path="/cennik-2026" element={<Pricelist2026Page />} />

        <Route
          path="/admin/login"
          element={isAdmin ? <Navigate to="/admin" replace /> : <AdminLoginPage />}
        />

        <Route
          path="/admin"
          element={isAdmin ? <AdminDashboardPage /> : <Navigate to="/admin/login" replace />}
        />

        <Route
          path="/admin/nastavenia"
          element={isAdmin ? <AdminAccommodationSettingsPage /> : <Navigate to="/admin/login" replace />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}