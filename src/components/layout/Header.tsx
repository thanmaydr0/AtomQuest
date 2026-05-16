import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-3">
      <div className="text-sm font-semibold">AtomQuest</div>
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-600">{user ? user.name : 'Not signed in'}</div>
        {user ? (
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 size-4" />
            Logout
          </Button>
        ) : null}
      </div>
    </header>
  )
}
