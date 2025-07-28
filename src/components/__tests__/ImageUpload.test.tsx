import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImageUpload from '../ImageUpload'
import { createWorker } from 'tesseract.js'

// Mock tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn()
}))

const mockCreateWorker = vi.mocked(createWorker)

describe('ImageUpload Component', () => {
  const mockOnPlayersExtracted = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload area with correct text', () => {
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    expect(screen.getByText('📸 Upload Player List Image')).toBeInTheDocument()
    expect(screen.getByText(/Take a photo or upload an image/)).toBeInTheDocument()
    expect(screen.getByText('Choose Image')).toBeInTheDocument()
  })

  it('handles drag and drop styling', () => {
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    const uploadArea = document.querySelector('.upload-area') as HTMLElement
    expect(uploadArea).toBeInTheDocument()
    
    // Test drag over
    fireEvent.dragOver(uploadArea)
    expect(uploadArea).toHaveClass('dragover')
    
    // Test drag leave
    fireEvent.dragLeave(uploadArea)
    expect(uploadArea).not.toHaveClass('dragover')
  })

  it('processes image file and extracts player names correctly', async () => {
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: 'Tinley\nElla\nAvrella\nYvette\nGabriela\nNoella\nSome noise text\nList of players\n'
        }
      }),
      terminate: vi.fn().mockResolvedValue(undefined)
    }
    
    mockCreateWorker.mockResolvedValue(mockWorker as any)
    
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    // Create a test file
    const file = new File(['fake image content'], 'names.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    // Simulate file selection
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    // Wait for OCR processing - check for new API call
    await waitFor(() => {
      expect(mockCreateWorker).toHaveBeenCalledWith({ logger: expect.any(Function) })
    }, { timeout: 5000 })
    
    await waitFor(() => {
      expect(mockWorker.loadLanguage).toHaveBeenCalledWith('eng')
    })
    
    await waitFor(() => {
      expect(mockWorker.initialize).toHaveBeenCalledWith('eng')
    })
    
    await waitFor(() => {
      expect(mockWorker.recognize).toHaveBeenCalledWith(file)
    })
    
    await waitFor(() => {
      expect(mockWorker.terminate).toHaveBeenCalled()
    })
    
    // Verify the names were extracted and filtered correctly
    await waitFor(() => {
      expect(mockOnPlayersExtracted).toHaveBeenCalledWith([
        'Tinley',
        'Ella', 
        'Avrella',
        'Yvette',
        'Gabriela',
        'Noella'
      ])
    })
  })

  it('filters out noise text from OCR results', async () => {
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: {
          text: 'Player List\nBadminton Club\nJohn\nlist\nJane\ncourt 1\nMike\nplayers today\nSarah\n\n   \nThis is a very long text that should be filtered out because names are usually shorter\n'
        }
      }),
      terminate: vi.fn().mockResolvedValue(undefined)
    }
    
    mockCreateWorker.mockResolvedValue(mockWorker as any)
    
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    const file = new File(['fake image content'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(mockOnPlayersExtracted).toHaveBeenCalledWith([
        'John',
        'Jane', 
        'Mike',
        'Sarah'
      ])
    })
  })

  it('shows processing message during OCR', async () => {
    // Mock a slow OCR process
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { text: 'Test\n' } }), 1000)
        )
      ),
      terminate: vi.fn().mockResolvedValue(undefined)
    }
    
    mockCreateWorker.mockResolvedValue(mockWorker as any)
    
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    const file = new File(['fake image content'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    // Should show processing message
    await waitFor(() => {
      expect(screen.getByText(/Processing image and extracting player names/)).toBeInTheDocument()
    })
  })

  it('handles OCR errors gracefully', async () => {
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockRejectedValue(new Error('OCR processing failed')),
      terminate: vi.fn().mockResolvedValue(undefined)
    }
    
    mockCreateWorker.mockResolvedValue(mockWorker as any)
    
    // Mock window.alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    const file = new File(['fake image content'], 'test.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to process image. Please try again or add players manually.')
    })
    
    // Should not call onPlayersExtracted on error
    expect(mockOnPlayersExtracted).not.toHaveBeenCalled()
    
    alertSpy.mockRestore()
  })

  it('handles drag and drop file upload', async () => {
    const mockWorker = {
      loadLanguage: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockResolvedValue({
        data: { text: 'Test Player\n' }
      }),
      terminate: vi.fn().mockResolvedValue(undefined)
    }
    
    mockCreateWorker.mockResolvedValue(mockWorker as any)
    
    render(<ImageUpload onPlayersExtracted={mockOnPlayersExtracted} />)
    
    const uploadArea = document.querySelector('.upload-area') as HTMLElement
    const file = new File(['fake image content'], 'test.png', { type: 'image/png' })
    
    // Create a mock drag event
    const dropEvent = new Event('drop', { bubbles: true }) as any
    dropEvent.dataTransfer = {
      files: [file]
    }
    
    fireEvent(uploadArea, dropEvent)
    
    await waitFor(() => {
      expect(mockWorker.recognize).toHaveBeenCalledWith(file)
    })
  })
}) 