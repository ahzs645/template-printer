import { Users, Palette, FileDown, Settings, Sun, Moon, CreditCard, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '../lib/utils'

type NavItem = {
  id: string
  icon: typeof Users
  label: string
}

const navItems: NavItem[] = [
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'design', icon: Palette, label: 'Design' },
  { id: 'export', icon: FileDown, label: 'Export' },
  { id: 'calibration', icon: SlidersHorizontal, label: 'Calibration' },
]

type IconNavProps = {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function IconNav({ activeTab, onTabChange }: IconNavProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="icon-nav">
      <div className="icon-nav__brand">
        <CreditCard size={20} />
      </div>

      <div className="icon-nav__items">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={cn('icon-nav__item', isActive && 'icon-nav__item--active')}
              onClick={() => onTabChange(item.id)}
              title={item.label}
            >
              <Icon size={20} />
              <span className="icon-nav__label">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="icon-nav__footer">
        <button
          type="button"
          className="icon-nav__item"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          <span className="icon-nav__label">Theme</span>
        </button>
        <button
          type="button"
          className={cn('icon-nav__item', activeTab === 'settings' && 'icon-nav__item--active')}
          onClick={() => onTabChange('settings')}
          title="Settings"
        >
          <Settings size={20} />
          <span className="icon-nav__label">Settings</span>
        </button>
      </div>
    </nav>
  )
}
