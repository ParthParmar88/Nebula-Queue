import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

const MenuContext = createContext(null)

/**
 * Accessible dropdown menu (WAI-ARIA menu pattern): arrow keys / Home / End move between
 * items, Escape closes and returns focus to the trigger, clicking outside closes.
 *
 * `trigger` is a render function receiving the props to spread on the trigger button.
 */
export function DropdownMenu({ trigger, align = 'start', side = 'bottom', className, children }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('[role^="menuitem"]')?.focus()

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close({ restoreFocus = true } = {}) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function onMenuKeyDown(event) {
    const items = [...menuRef.current.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])')]
    const index = items.indexOf(document.activeElement)
    const focusAt = (i) => items[(i + items.length) % items.length]?.focus()

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(items.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close()
        break
      case 'Tab':
        close({ restoreFocus: false })
        break
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        },
      })}
      {open && (
        <MenuContext.Provider value={{ close }}>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            onKeyDown={onMenuKeyDown}
            className={cn(
              'absolute z-40 min-w-56 animate-pop-in rounded-lg border border-border bg-surface p-1 shadow-overlay',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
              align === 'end' ? 'right-0' : 'left-0'
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  )
}

const itemClass = cn(
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-13 text-fg outline-none',
  'transition-colors hover:bg-surface-2 focus:bg-surface-2',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted'
)

export function MenuItem({ icon: Icon, onSelect, children, className }) {
  const { close } = useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={cn(itemClass, className)}
      onClick={() => {
        close({ restoreFocus: false })
        onSelect?.()
      }}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </button>
  )
}

/** Single-choice item (e.g. theme). Stays open so the user sees the check move. */
export function MenuRadioItem({ icon: Icon, checked, onSelect, children }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className={itemClass}
      onClick={onSelect}
    >
      {Icon && <Icon aria-hidden="true" />}
      <span className="flex-1">{children}</span>
      {checked && <Check className="!text-accent" aria-hidden="true" />}
    </button>
  )
}

export function MenuLabel({ children }) {
  return <div className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-wider text-fg-subtle">{children}</div>
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-border" />
}

/** Arbitrary non-interactive content at the top of a menu (e.g. the signed-in account). */
export function MenuHeader({ children }) {
  return <div className="px-2 py-2">{children}</div>
}
