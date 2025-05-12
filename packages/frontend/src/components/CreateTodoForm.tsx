'use client'

import { useState } from 'react'

type CreateTodoFormProps = {
  listName: string
}

export default function CreateTodoForm({ listName }: CreateTodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [tags, setTags] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [useAI, setUseAI] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) return
    
    setIsSubmitting(true)
    
    // Will be replaced with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Reset form
    setTitle('')
    setDescription('')
    setPriority('medium')
    setTags('')
    setDueDate('')
    setUseAI(false)
    setIsSubmitting(false)
    
    // Toast or notification would be added here
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="ocean-input w-full"
          required
        />
      </div>
      
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description (optional)"
          className="ocean-input w-full h-20 resize-none"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-ocean-medium dark:text-ocean-light mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            className="ocean-input w-full"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-ocean-medium dark:text-ocean-light mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="work, important, etc."
            className="ocean-input w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm text-ocean-medium dark:text-ocean-light mb-1">
            Due Date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ocean-input w-full"
          />
        </div>
      </div>
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="useAI"
          checked={useAI}
          onChange={(e) => setUseAI(e.target.checked)}
          className="w-4 h-4 rounded text-ocean-medium focus:ring-ocean-light"
        />
        <label htmlFor="useAI" className="ml-2 text-sm text-ocean-medium dark:text-ocean-light">
          Use AI to suggest tags and priority
        </label>
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <div className="text-sm text-ocean-medium dark:text-ocean-light">
          Adding to: <span className="font-medium">{listName}</span>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className={`ocean-button ${
            (isSubmitting || !title.trim()) ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? 'Adding...' : 'Add Todo'}
        </button>
      </div>
    </form>
  )
}