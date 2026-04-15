import { createBrowserRouter } from 'react-router-dom'
import PublicHomePage from '../pages/PublicHomePage'
import OrderPage from '../pages/OrderPage'
import AdminLoginPage from '../pages/AdminLoginPage'
import AdminDashboardPage from '../pages/AdminDashboardPage'
import NotFoundPage from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicHomePage />,
  },
  {
    path: '/objednavka',
    element: <OrderPage />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/admin',
    element: <AdminDashboardPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])