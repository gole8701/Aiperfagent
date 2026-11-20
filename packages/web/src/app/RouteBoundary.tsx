import { Component, type ReactNode } from 'react'

import { Button } from '../components/Button'
import { ErrorBox } from '../components/Card'

/** Catches a screen that failed to load or render, so the page offers Reload instead of hanging. */
export class RouteBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error?: Error }
> {
  override state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  override componentDidUpdate(prev: { resetKey: string }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: undefined })
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <ErrorBox
          error={{
            message: 'This screen could not be loaded',
            hint: 'PerfAgent was probably updated while this tab was open.',
          }}
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      </div>
    )
  }
}
