import { useQueryClient } from '@tanstack/react-query'
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../context/authContext.js'
import { useTheme } from '../../context/themeContext.js'
import { initials } from '../../lib/format'
import Badge from '../ui/Badge'
import {
  DropdownMenu,
  MenuHeader,
  MenuItem,
  MenuLabel,
  MenuRadioItem,
  MenuSeparator,
} from '../ui/DropdownMenu'

const THEMES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function UserMenu() {
  const { email, isAdmin, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()

  function signOut() {
    logout()
    queryClient.clear()
  }

  return (
    <DropdownMenu
      side="top"
      className="w-full"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-surface-2 aria-expanded:bg-surface-2"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg"
            aria-hidden="true"
          >
            {initials(email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-13 font-medium text-fg">{email}</span>
            <span className="block text-xs text-fg-muted">{isAdmin ? 'Admin' : 'Member'}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
          <span className="sr-only">Account menu</span>
        </button>
      )}
    >
      <MenuHeader>
        <p className="truncate text-13 font-medium text-fg">{email}</p>
        <Badge tone={isAdmin ? 'accent' : 'neutral'} className="mt-1.5">
          {isAdmin ? 'Admin · sees all jobs' : 'Member · sees own jobs'}
        </Badge>
      </MenuHeader>
      <MenuSeparator />
      <MenuLabel>Theme</MenuLabel>
      {THEMES.map((t) => (
        <MenuRadioItem key={t.value} icon={t.icon} checked={theme === t.value} onSelect={() => setTheme(t.value)}>
          {t.label}
        </MenuRadioItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={LogOut} onSelect={signOut}>
        Sign out
      </MenuItem>
    </DropdownMenu>
  )
}
