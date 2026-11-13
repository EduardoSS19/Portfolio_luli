import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function useCmsConfirm() {
  const [options, setOptions] = useState(null)
  const resolver = useRef(null)
  const previousFocus = useRef(null)
  const dialogRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  const confirm = useCallback(nextOptions => new Promise(resolve => {
    // Cada confirmação guarda seu próprio acionador e contexto; não reaproveita
    // o foco ou o alvo de uma operação anterior.
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    resolver.current?.(false)
    resolver.current = resolve
    setOptions({
      title: 'Confirmar ação',
      message: 'Deseja continuar?',
      target: '',
      confirmLabel: 'Confirmar',
      variant: 'default',
      ...nextOptions,
    })
  }), [])

  const settle = value => {
    setOptions(null)
    if (resolver.current) {
      resolver.current(value)
      resolver.current = null
    }
    const trigger = previousFocus.current
    previousFocus.current = null
    if (trigger?.isConnected) {
      requestAnimationFrame(() => trigger.focus({ preventScroll: true }))
    }
  }

  useEffect(() => {
    if (!options) return
    // Foca o diálogo sem provocar scroll automático até um botão fora da área
    // visível. O usuário escolhe explicitamente cancelar ou confirmar.
    dialogRef.current?.focus({ preventScroll: true })
  }, [options])

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      settle(false)
      return
    }
    if (event.key !== 'Tab') return
    const controls = dialogRef.current?.querySelectorAll('button:not(:disabled)')
    if (!controls?.length) {
      event.preventDefault()
      dialogRef.current?.focus({ preventScroll: true })
      return
    }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (document.activeElement === dialogRef.current) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus({ preventScroll: true })
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
  }

  const dialogNode = options ? (
    <div
      className="cms-confirm-overlay"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) settle(false) }}
      onKeyDown={handleKeyDown}
    >
      <section
        ref={dialogRef}
        className="cms-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
      >
        <span className="cms-confirm-eyebrow">CONFIRMAÇÃO</span>
        <h2 id={titleId}>{options.title}</h2>
        <p id={messageId}>{options.message}</p>
        {options.target && <p className="cms-confirm-target"><strong>Item selecionado:</strong> {options.target}</p>}
        <footer>
          <button type="button" className="cms-confirm-cancel" onClick={() => settle(false)}>Cancelar</button>
          <button
            type="button"
            className={'cms-confirm-accept' + (options.variant === 'danger' ? ' danger' : '')}
            onClick={() => settle(true)}
          >
            {options.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  ) : null

  // O portal remove o diálogo de ancestrais do painel que possam criar
  // um containing block (transform/filter) ou recortar position: fixed.
  return { confirm, dialogNode: dialogNode ? createPortal(dialogNode, document.body) : null }
}
