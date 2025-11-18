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
        <aside className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col flex-shrink-0">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    ID Card Maker
                </h1>
                <p className="text-xs text-zinc-500 mt-1">Professional Card Printer</p>
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
                                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                            )}
                            onClick={() => onTabChange(item.id as ActiveTab)}
                        >
                            <Icon size={18} />
                            {item.label}
                        </Button>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                        activeTab === 'settings' && "bg-zinc-100 dark:bg-zinc-800"
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
