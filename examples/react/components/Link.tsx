import React, { useState } from 'react'

export const LINK_STATUS = {
  HOVERED: 'hovered',
  NORMAL: 'normal',
}

export function Link({
  page,
  children,
}: React.PropsWithChildren<{ page: string }>) {
  const [status, statusHandlers] = useLinkState()

  return (
    <a
      className={status}
      href={page || '#'}
      aria-label={`Link is ${status}`}
      {...statusHandlers}
    >
      {children}
    </a>
  )
}

// Understand that this is merely for showing how to work with hooks.
// At this point, it hardly makes sense to have this as a custom hook.
export function useLinkState() {
  const [status, setStatus] = useState(LINK_STATUS.NORMAL)

  const onMouseEnter = () => {
    setStatus(LINK_STATUS.HOVERED)
  }

  const onMouseLeave = () => {
    setStatus(LINK_STATUS.NORMAL)
  }

  return [
    status,
    {
      onMouseEnter,
      onMouseLeave,
    },
  ] as const
}
