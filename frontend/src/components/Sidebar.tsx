import { Users, LayoutTemplate, Download, LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

export type ActiveTab = 'dashboard' | 'users' | 'design' | 'export' | 'settings'

interface SidebarProps {
    activeTab: ActiveTab
    onTabChange: (tab: ActiveTab) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'design', label: 'Design', icon: LayoutTemplate },
        { id: 'export', label: 'Export', icon: Download },
    ]

    return (
        <aside className="flex w-64 flex-shrink-0 flex-col border-r border-line bg-surface">
            <div className="border-b border-line p-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    ID Card Maker
                </h1>
                <p className="mt-1 text-xs text-ink-muted">Professional Card Printer</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.id
                    return (
                        <Button
                            key={item.id}
                            variant={isActive ? 'secondary' : 'ghost'}
                            className={cn(
                                "w-full justify-start gap-3 font-medium",
                                isActive
                                    ? "bg-accent-soft text-accent hover:bg-accent-soft"
                                    : "text-ink-muted hover:text-ink"
                            )}
                            onClick={() => onTabChange(item.id as ActiveTab)}
                        >
                            <Icon size={18} />
                            {item.label}
                        </Button>
                    )
                })}
            </nav>

            <div className="border-t border-line p-4">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 font-medium text-ink-muted hover:text-ink",
                        activeTab === 'settings' && 'bg-hover text-ink'
                    )}
                    onClick={() => onTabChange('settings')}
                >
                    <Settings size={18} />
                    Settings
                </Button>
            </div>
        </aside>
    )
}
