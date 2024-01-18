import { useCounter } from './hooks/useCounter'
import './App.css'

function App() {
  const { count, increment } = useCounter()

  return (
    <div className="App">
      <header className="App-header">
        <p>Hello Vite + React!</p>
        <p>
          <button
            type="button"
            onClick={increment}
          >
            count is:
            {' '}
            {count}
          </button>
        </p>
        <p>
          Edit
          {' '}
          <code>App.tsx</code>
          {' '}
          and save to test HMR updates.
        </p>
        <p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
          {' | '}
          <a
            className="App-link"
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

export default App
