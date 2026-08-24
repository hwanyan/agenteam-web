import type { TabItem } from '../state/useAppState'

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
          <span className="tab-item-icon">{tab.kind === 'workspace' ? '💬' : '👥'}</span>
          <span className="tab-item-title">{tab.title}</span>
          <span
            className="tab-item-close"
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  )
}
