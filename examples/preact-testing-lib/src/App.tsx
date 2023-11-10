import { useCount } from './hooks/useCount'
import './App.less'

export default function App() {
  const { count, inc } = useCount()

  return (
    <div className="app">
      <header>
        <h1>Hello Vite & Preact!</h1>
        <p>
          <button onClick={inc}>
            Count is:
            {count}
          </button>
        </p>
        <p>
          <a
            className="app-link"
            href="https://preactjs.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn Preact
          </a>
          {' | '}
          <a
            className="app-link"
            href="https://vitejs.dev/guide/features.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vite Docs
          </a>
        </p>
      </header>
    </div>
  )
}
