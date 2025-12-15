'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Quote,
    Heading1, Heading2, Type,
    Trash2, Menu, Plus, Check, X,
    MoreVertical
} from 'lucide-react';

interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

// Custom Modal Component
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

const Modal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }: ModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3 className="modal-title">{title}</h3>
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button className="modal-btn cancel" onClick={onClose}>{cancelText}</button>
                    <button className={`modal-btn ${isDanger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

export default function Home() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Data Fetching ---
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

    useEffect(() => {
        if (!isLoading && notes.length === 0 && !activeNote) {
            createNewNote();
        }
    }, [isLoading, notes.length, activeNote]);

    // --- Title Sync ---
    useEffect(() => {
        document.title = activeNote && activeNote.title
            ? `${activeNote.title} - Ed's Notes`
            : "Ed's Notes";
    }, [activeNote]);

    // --- Saving Logic ---
    const saveNote = useCallback(async (noteId: string, noteTitle: string, noteContent: string) => {
        try {
            setIsSaving(true);
            await fetch(`/api/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: noteTitle || 'Untitled', content: noteContent }),
            });
            fetchNotes();
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    }, []);

    const debouncedSave = useCallback((noteId: string, noteTitle: string, noteContent: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveNote(noteId, noteTitle, noteContent);
        }, 1000);
    }, [saveNote]);

    // --- Actions ---
    const createNewNote = async () => {
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Untitled', content: '' }),
            });
            const newNote = await res.json();
            setNotes(prev => [newNote, ...prev]);
            selectNote(newNote);
            if (window.innerWidth <= 768) setSidebarOpen(false);
        } catch (error) {
            console.error('Failed to create:', error);
        }
    };

    const confirmDelete = (noteId: string) => {
        setNoteToDelete(noteId);
        setOpenMenuId(null);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!noteToDelete) return;

        try {
            await fetch(`/api/notes/${noteToDelete}`, { method: 'DELETE' });
            const remaining = notes.filter(n => n.id !== noteToDelete);
            setNotes(remaining);

            if (activeNote?.id === noteToDelete) {
                if (remaining.length > 0) {
                    selectNote(remaining[0]);
                } else {
                    setActiveNote(null);
                    setTitle('');
                    setContent('');
                    if (editorRef.current) editorRef.current.innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to delete:', error);
        } finally {
            setIsDeleteModalOpen(false);
            setNoteToDelete(null);
        }
    };

    const selectNote = (note: Note) => {
        setActiveNote(note);
        setTitle(note.title === 'Untitled' ? '' : note.title);
        setContent(note.content);
        if (editorRef.current) editorRef.current.innerHTML = note.content;
        if (window.innerWidth <= 768) setSidebarOpen(false);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        if (activeNote) {
            setActiveNote({ ...activeNote, title: newTitle });
            debouncedSave(activeNote.id, newTitle, content);
        }
    };

    const handleContentInput = () => {
        if (editorRef.current && activeNote) {
            const newContent = editorRef.current.innerHTML;
            setContent(newContent);
            debouncedSave(activeNote.id, title, newContent);
        }
    };

    const execCmd = (cmd: string, val?: string) => {
        document.execCommand(cmd, false, val);
        editorRef.current?.focus();
        handleContentInput();
    };

    const toggleMenu = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === noteId ? null : noteId);
    };

    // --- Components ---
    const ToolbarButton = ({ icon: Icon, cmd, val, title }: any) => (
        <button
            className="tool-btn"
            onClick={(e) => { e.preventDefault(); execCmd(cmd, val); }}
            title={title}
        >
            <Icon size={18} />
        </button>
    );

    return (
        <div className="app-container">
            {/* Mobile Sidebar Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Global Backdrop to Close Menus */}
            {openMenuId && (
                <div
                    className="dropdown-backdrop"
                    onClick={() => setOpenMenuId(null)}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Note"
                message="Are you sure you want to delete this note? This action cannot be undone."
                confirmText="Delete"
                isDanger={true}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <Image
                        src="https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png"
                        alt="Logo"
                        width={32} height={32}
                        className="sidebar-logo"
                    />
                    <span className="sidebar-title">Ed&apos;s Notes</span>
                    <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="sidebar-actions">
                    <button className="new-note-btn" onClick={createNewNote}>
                        <Plus size={18} /> New Note
                    </button>
                </div>

                <div className="notes-list">
                    {notes.map(note => (
                        <div
                            key={note.id}
                            className={`note-item ${activeNote?.id === note.id ? 'active' : ''}`}
                            onClick={() => selectNote(note)}
                        >
                            <div className="note-item-content">
                                <div className="note-item-title">{note.title || 'Untitled'}</div>
                                <div className="note-item-preview">
                                    {note.content ? note.content.replace(/<[^>]*>/g, '') : 'No content'}
                                </div>
                            </div>

                            <button
                                className={`note-actions-btn ${openMenuId === note.id ? 'active' : ''}`}
                                onClick={(e) => toggleMenu(e, note.id)}
                            >
                                <MoreVertical size={16} />
                            </button>

                            {/* Dropdown */}
                            {openMenuId === note.id && (
                                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="dropdown-item danger"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            confirmDelete(note.id);
                                        }}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="editor-container">
                {activeNote ? (
                    <>
                        <header className="editor-header">
                            {/* Only menu button and delete action here now */}
                            <div className="flex items-center">
                                <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                                    <Menu size={24} />
                                </button>
                            </div>

                            <div className="editor-actions">
                                <button className="icon-btn danger" onClick={() => confirmDelete(activeNote.id)}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </header>

                        {/* Seamless Toolbar */}
                        <div className="toolbar">
                            <div className="toolbar-group">
                                <ToolbarButton icon={Bold} cmd="bold" title="Bold" />
                                <ToolbarButton icon={Italic} cmd="italic" title="Italic" />
                                <ToolbarButton icon={Underline} cmd="underline" title="Underline" />
                                <ToolbarButton icon={Strikethrough} cmd="strikeThrough" title="Strike" />
                            </div>

                            <div className="toolbar-group">
                                <ToolbarButton icon={Heading1} cmd="formatBlock" val="h1" title="Heading 1" />
                                <ToolbarButton icon={Heading2} cmd="formatBlock" val="h2" title="Heading 2" />
                                <ToolbarButton icon={Type} cmd="formatBlock" val="p" title="Paragraph" />
                            </div>

                            <div className="toolbar-group">
                                <ToolbarButton icon={List} cmd="insertUnorderedList" title="Bullet List" />
                                <ToolbarButton icon={ListOrdered} cmd="insertOrderedList" title="Numbered List" />
                                <ToolbarButton icon={Quote} cmd="formatBlock" val="blockquote" title="Quote" />
                            </div>

                            <div className="toolbar-group">
                                <ToolbarButton icon={AlignLeft} cmd="justifyLeft" title="Left" />
                                <ToolbarButton icon={AlignCenter} cmd="justifyCenter" title="Center" />
                                <ToolbarButton icon={AlignRight} cmd="justifyRight" title="Right" />
                            </div>
                        </div>

                        <div className="editor-content">
                            {/* New Separate Title Block */}
                            <div className="title-block">
                                <input
                                    value={title}
                                    onChange={handleTitleChange}
                                    placeholder="Note Title"
                                    className="title-input-large"
                                />
                            </div>

                            <div
                                ref={editorRef}
                                className="rich-editor"
                                contentEditable
                                suppressContentEditableWarning
                                onInput={handleContentInput}
                                data-placeholder="Start writing..."
                            />
                        </div>

                        <div className={`save-status ${isSaving ? 'visible' : ''}`}>
                            Saving...
                        </div>
                    </>
                ) : (
                    <div className="empty-state">
                        <div className="mobile-header-placeholder">
                            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                                <Menu size={24} />
                            </button>
                            <Image
                                src="https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png"
                                alt="Logo"
                                width={32} height={32}
                            />
                        </div>
                        <p>Select a note or create a new one</p>
                        <button className="new-note-btn" style={{ width: 'auto', padding: '10px 24px' }} onClick={createNewNote}>
                            Create Note
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
