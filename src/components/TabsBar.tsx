import type { TabItem } from '../state/useAppState'
import { IconChat, IconClose, IconTeam } from '../icons'

interface TabsBarProps {
  tabs: TabItem[]
  activeTabId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
}

export function TabsBar({ tabs, activeTabId, onActivate, onClose }: TabsBarProps) {
  if (tabs.length === 0) return null
  return (
    <div className="tabs-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? 'tab-item-active' : ''}`}
          onClick={() => onActivate(tab.id)}
        >
          <span className="tab-item-icon">
            {tab.kind === 'workspace' ? <IconChat size={13} /> : <IconTeam size={13} />}
          </span>
          <span className="tab-item-title">{tab.title}</span>
          <span
            className="tab-item-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
          >
            <IconClose size={11} />
          </span>
        </div>
      ))}
    </div>
  )
}
