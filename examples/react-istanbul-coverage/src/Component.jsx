import { Children, useState } from "react"

export const Component = ({children}) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const handleToggle = () => {
        setIsExpanded(prev => !prev)
    }

    return <div>
        <button onClick={handleToggle}>{isExpanded ? 'Collapse' : 'Expand'}</button>
        {isExpanded && children}
    </div>
}