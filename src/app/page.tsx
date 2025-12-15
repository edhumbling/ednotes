'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update document title
  useEffect(() => {
    if (activeNote && activeNote.title) {
      document.title = `${activeNote.title} - Ed's Notes`;
    } else {
      document.title = "Ed's Notes";
    }
  }, [activeNote]);

  // Fetch all notes
  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Auto-create a new note on first load if no notes exist
  useEffect(() => {
    if (!isLoading && notes.length === 0 && !activeNote) {
      createNewNote();
    }
  }, [isLoading, notes.length, activeNote]);

  // Save note with debounce
  const saveNote = useCallback(async (noteId: string, noteTitle: string, noteContent: string) => {
    try {
      setIsSaving(true);
      await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noteTitle || 'Untitled', content: noteContent }),
      });
      setShowSaveIndicator(true);
      setTimeout(() => setShowSaveIndicator(false), 2000);
      fetchNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save
  const debouncedSave = useCallback((noteId: string, noteTitle: string, noteContent: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(noteId, noteTitle, noteContent);
    }, 1000);
  }, [saveNote]);

  // Create new note
  const createNewNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', content: '' }),
      });
      const newNote = await res.json();
      setNotes(prev => [newNote, ...prev]);
      setActiveNote(newNote);
      setTitle('');
      setContent('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        editorRef.current.focus();
      }
      setSidebarOpen(false);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  // Select note
  const selectNote = (note: Note) => {
    setActiveNote(note);
    setTitle(note.title === 'Untitled' ? '' : note.title);
    setContent(note.content);
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content;
    }
    setSidebarOpen(false);
  };

  // Delete note
  const deleteNote = async (noteId: string) => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (activeNote?.id === noteId) {
        setActiveNote(null);
        setTitle('');
        setContent('');
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // Update active note immediately for title reflection
    if (activeNote) {
      setActiveNote({ ...activeNote, title: newTitle });
      debouncedSave(activeNote.id, newTitle, content);
    }
  };

  // Handle content change
  const handleContentChange = () => {
    if (editorRef.current && activeNote) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      debouncedSave(activeNote.id, title, newContent);
    }
  };

  // Toolbar commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentChange();
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get preview text
  const getPreview = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.slice(0, 50) + (text.length > 50 ? '...' : '');
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Mobile Sidebar Toggle */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Image
            src="https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png"
            alt="Ed's Notes"
            width={36}
            height={36}
            className="sidebar-logo"
          />
          <span className="sidebar-title">Ed&apos;s Notes</span>
        </div>

        <div className="sidebar-actions">
          <button className="new-note-btn" onClick={createNewNote}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Note
          </button>
        </div>

        <div className="notes-list">
          <div className="notes-list-header">History</div>
          {notes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${activeNote?.id === note.id ? 'active' : ''}`}
              onClick={() => selectNote(note)}
            >
              <div className="note-item-title">{note.title || 'Untitled'}</div>
              <div className="note-item-preview">{getPreview(note.content) || 'No content'}</div>
              <div className="note-item-date">{formatDate(note.updatedAt)}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Editor */}
      <main className="editor-container">
        {activeNote ? (
          <>
            <header className="editor-header">
              <input
                type="text"
                className="editor-title-input"
                placeholder="Untitled"
                value={title}
                onChange={handleTitleChange}
              />
              <div className="editor-actions">
                <button className="editor-btn danger" onClick={() => deleteNote(activeNote.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6" />
                    <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
                  </svg>
                  Delete
                </button>
              </div>
            </header>

            {/* Toolbar */}
            <div className="toolbar">
              <button className="toolbar-btn" onClick={() => execCommand('bold')} title="Bold">
                <strong>B</strong>
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('italic')} title="Italic">
                <em>I</em>
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('underline')} title="Underline">
                <u>U</u>
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('strikeThrough')} title="Strikethrough">
                <s>S</s>
              </button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => execCommand('formatBlock', 'h1')} title="Heading 1">
                H1
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('formatBlock', 'h2')} title="Heading 2">
                H2
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('formatBlock', 'h3')} title="Heading 3">
                H3
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('formatBlock', 'p')} title="Paragraph">
                P
              </button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                  <circle cx="4" cy="6" r="1" fill="currentColor" />
                  <circle cx="4" cy="12" r="1" fill="currentColor" />
                  <circle cx="4" cy="18" r="1" fill="currentColor" />
                </svg>
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="10" y1="6" x2="21" y2="6" />
                  <line x1="10" y1="12" x2="21" y2="12" />
                  <line x1="10" y1="18" x2="21" y2="18" />
                  <text x="3" y="8" fontSize="8" fill="currentColor">1</text>
                  <text x="3" y="14" fontSize="8" fill="currentColor">2</text>
                  <text x="3" y="20" fontSize="8" fill="currentColor">3</text>
                </svg>
              </button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => execCommand('formatBlock', 'blockquote')} title="Quote">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10,10H6a2,2,0,0,1-2-2V6A2,2,0,0,1,6,4H8a2,2,0,0,1,2,2v6a4,4,0,0,1-4,4" />
                  <path d="M20,10H16a2,2,0,0,1-2-2V6a2,2,0,0,1,2-2h2a2,2,0,0,1,2,2v6a4,4,0,0,1-4,4" />
                </svg>
              </button>
              <button className="toolbar-btn" onClick={() => execCommand('removeFormat')} title="Clear Formatting">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="3" x2="21" y2="21" />
                  <path d="M11,7l-1-4H6L4,10" />
                  <path d="M14,14l-4,7" />
                </svg>
              </button>
            </div>

            {/* Editor Content */}
            <div className="editor-content">
              <div
                ref={editorRef}
                className="rich-editor"
                contentEditable
                onInput={handleContentChange}
                data-placeholder="Start writing..."
                suppressContentEditableWarning
              />
            </div>

            {/* Status Bar */}
            <div className="status-bar">
              <span className="status-text">
                Last saved: {formatDate(activeNote.updatedAt)}
              </span>
              <span className={`status-text ${isSaving ? '' : 'status-saved'}`}>
                {isSaving ? 'Saving...' : '✓ Saved'}
              </span>
            </div>
          </>
        ) : (
          <div className="empty-state fade-in">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">No note selected</div>
            <div className="empty-state-subtext">Create a new note or select from history</div>
          </div>
        )}
      </main>

      {/* Save Indicator */}
      <div className={`save-indicator ${showSaveIndicator ? 'visible' : ''}`}>
        ✓ Note saved
      </div>
    </div>
  );
}
