'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Quote,
    Heading1, Heading2, Type,
    Trash2, Menu, Plus, X,
    MoreVertical, PanelLeftClose, PanelLeftOpen
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

    // Sidebar State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Menu & Modal State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (mobile) setSidebarOpen(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Format date
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // --- Data Fetching ---
    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/notes');
            const data = await res.json();
            setNotes(data);

            // Attempt to restore last active note
            const lastId = localStorage.getItem('ednotes-active-id');
            if (lastId) {
                const found = data.find((n: Note) => n.id === lastId);
                if (found) {
                    // We manually select properly to avoid side-effects like closing sidebar prematurely on load
                    setActiveNote(found);
                    setTitle(found.title === 'Untitled' ? '' : found.title);
                    setContent(found.content);
                }
            }
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    // Persist Active Note ID
    useEffect(() => {
        if (activeNote) {
            localStorage.setItem('ednotes-active-id', activeNote.id);
        } else {
            localStorage.removeItem('ednotes-active-id');
        }
    }, [activeNote]);

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
            if (isMobile) setSidebarOpen(false);
        } catch (error) {
            console.error('Failed to create:', error);
        }
    };

    const confirmDelete = (noteId: string) => {
        console.log('Confirm delete called for:', noteId);
        setNoteToDelete(noteId);
        setIsDeleteModalOpen(true);
        setTimeout(() => setOpenMenuId(null), 100);
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
        if (isMobile) setSidebarOpen(false);
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

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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
                className={`sidebar-overlay ${sidebarOpen && isMobile ? 'active' : ''}`}
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
            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'} ${isMobile ? 'mobile' : ''}`}>
                <div className="sidebar-header">
                    <div
                        className="flex flex-row items-center gap-3 cursor-pointer select-none"
                        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}
                        onClick={() => {
                            setActiveNote(null);
                            setTitle('');
                            setContent('');
                            if (editorRef.current) editorRef.current.innerHTML = '';
                            if (isMobile) setSidebarOpen(false);
                        }}
                    >
                        <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                            <Image
                                src="https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png"
                                alt="Logo"
                                fill
                                className="sidebar-logo"
                                style={{ objectFit: 'cover', borderRadius: '0px' }}
                            />
                        </div>
                        <span className="sidebar-title flex-1 truncate text-base font-semibold">Ed&apos;s Notes</span>
                    </div>

                    {/* Desktop Retract Button */}
                    {!isMobile && (
                        <button className="desktop-sidebar-toggle" onClick={toggleSidebar}>
                            <PanelLeftClose size={20} />
                        </button>
                    )}

                    {/* Mobile Close Button */}
                    {isMobile && (
                        <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}>
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="sidebar-actions">
                    <button className="new-note-btn" onClick={createNewNote}>
                        <Plus size={18} /> New Note
                    </button>
                </div>

                <div className="notes-list">
                    {(() => {
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        const yesterday = today - 86400000;
                        const lastWeek = today - 86400000 * 7;
                        const lastMonth = today - 86400000 * 30;

                        const groups: { [key: string]: Note[] } = {
                            'Today': [],
                            'Yesterday': [],
                            'Last 7 Days': [],
                            'This Month': [],
                            'Older': []
                        };

                        notes.forEach(note => {
                            const noteDate = new Date(note.updatedAt).getTime();
                            if (noteDate >= today) groups['Today'].push(note);
                            else if (noteDate >= yesterday) groups['Yesterday'].push(note);
                            else if (noteDate >= lastWeek) groups['Last 7 Days'].push(note);
                            else if (noteDate >= lastMonth) groups['This Month'].push(note);
                            else groups['Older'].push(note);
                        });

                        return Object.entries(groups).map(([label, groupNotes]) => (
                            groupNotes.length > 0 && (
                                <div key={label} className="notes-group">
                                    <div className="notes-group-label">{label}</div>
                                    {groupNotes.map(note => (
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
                                                <div className="note-item-date">{formatDate(note.updatedAt)}</div>
                                            </div>

                                            <button
                                                className={`note-actions-btn ${openMenuId === note.id ? 'active' : ''}`}
                                                onClick={(e) => toggleMenu(e, note.id)}
                                            >
                                                <MoreVertical size={16} />
                                            </button>

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
                            )
                        ));
                    })()}
                </div>
            </aside>

            {/* Main Content */}
            <main className="editor-container">
                {/* Global Editor Header - Always Visible */}
                <header className="editor-header relative" style={{ position: 'relative' }}>
                    <div className="flex items-center gap-3 z-10">
                        {/* Mobile Menu Button */}
                        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>

                        {/* Desktop Expand Button (when sidebar closed) */}
                        {!sidebarOpen && !isMobile && (
                            <button className="desktop-sidebar-toggle-open" onClick={toggleSidebar}>
                                <PanelLeftOpen size={20} />
                            </button>
                        )}
                    </div>

                    {/* Absolute Centered Logo */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        pointerEvents: 'none'
                    }}>
                        <Image
                            src="https://ik.imagekit.io/humbling/Gemini_Generated_Image_o1mdo6o1mdo6o1md%20(1).png"
                            alt="Logo"
                            width={36} height={36}
                            className="sidebar-logo"
                            style={{ borderRadius: '0px' }}
                            priority
                        />
                    </div>

                    <div className="editor-actions z-10" style={{ marginLeft: 'auto' }}>
                        {activeNote && (
                            <button className="icon-btn danger" onClick={() => confirmDelete(activeNote.id)}>
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </header>

                {activeNote ? (
                    <>
                        {/* Seamless Toolbar */}
                        <div className="toolbar">
                            <div className="toolbar-group">
                                <ToolbarButton icon={Bold} cmd="bold" title="Bold" />
                                <ToolbarButton icon={Italic} cmd="italic" title="Italic" />
                                <ToolbarButton icon={Underline} cmd="underline" title="Underline" />
                                <ToolbarButton icon={Strikethrough} cmd="strikeThrough" title="Strike" />
                            </div>

                            <div className="toolbar-group">
                                <select
                                    className="toolbar-select"
                                    onChange={(e) => execCmd('fontName', e.target.value)}
                                    defaultValue="Inter"
                                    title="Font Family"
                                >
                                    <option value="Inter">Default</option>
                                    <option value="serif">Serif</option>
                                    <option value="'Fira Code', monospace">Mono</option>
                                    <option value="cursive">Handwriting</option>
                                </select>
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
                            {/* Title Block */}
                            <div className="title-block">
                                <input
                                    value={title}
                                    onChange={handleTitleChange}
                                    placeholder="Note Title"
                                    className="title-input-large"
                                />
                                {/* Date in Editor */}
                                <div className="note-meta">
                                    {formatDate(activeNote.updatedAt)} • {activeNote.content ? activeNote.content.length : 0} characters
                                </div>
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
                        {/* No logo here, it's in the header now */}
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
