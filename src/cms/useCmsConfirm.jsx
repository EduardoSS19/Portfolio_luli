import { useCallback, useId, useRef, useState } from 'react'

export function useCmsConfirm() {
  const [options, setOptions] = useState(null)
  const resolver = useRef(null)
  const titleId = useId()
  const messageId = useId()

  const confirm = useCallback(nextOptions => new Promise(resolve => {
    resolver.current = resolve
    setOptions({
      title: 'Confirmar ação',
      message: 'Deseja continuar?',
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
  }

  const dialogNode = options ? (
    <div
      className="cms-confirm-overlay"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) settle(false) }}
      onKeyDown={event => { if (event.key === 'Escape') settle(false) }}
    >
      <section
        className="cms-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <span className="cms-confirm-eyebrow">CONFIRMAÇÃO</span>
        <h2 id={titleId}>{options.title}</h2>
        <p id={messageId}>{options.message}</p>
        <footer>
          <button type="button" className="cms-confirm-cancel" autoFocus onClick={() => settle(false)}>Cancelar</button>
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

  return { confirm, dialogNode }
}
