import { useEffect } from 'react'

export default function Modal({ title, subtitle, leading, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-on-surface/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-surface-container"
      >
        <div className="flex items-start justify-between gap-4 p-6 bg-surface-container-low/60 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            {leading}
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
              {subtitle && (
                <p className="font-body-sm text-body-sm text-secondary">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-secondary hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}