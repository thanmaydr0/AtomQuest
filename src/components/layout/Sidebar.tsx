import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/manager', label: 'Manager' },
  { to: '/admin', label: 'Admin' },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-60 border-r bg-white p-4">
      <nav className="space-y-2">
        {items.map((it) => {
          const active = location.pathname === it.to
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                'block rounded-md px-3 py-2 text-sm hover:bg-amber-50',
                active ? 'bg-amber-200/40 text-black' : 'text-gray-800'
              )}
            >
              {it.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
