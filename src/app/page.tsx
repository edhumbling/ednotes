'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Quote,
    Heading1, Heading2, Type,
    Trash2, Menu, Plus, X,
    PanelLeftClose, PanelLeftOpen,
    Cloud, CloudOff, RefreshCcw
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalNote } from '@/lib/db/local-db';
import { v4 as uuidv4 } from 'uuid';

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
    // Local DB Query
    const notes = useLiveQuery(
        () => db.notes.where('isDeleted').equals(0).toArray(),
        []
    ) || [];

    // Sort notes locally
    const sortedNotes = [...notes].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const [activeNote, setActiveNote] = useState<LocalNote | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

    // Sidebar State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Responsive Management ---
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

    // --- Sync Logic ---
    const runSync = useCallback(async () => {
        if (!navigator.onLine) {
            setSyncStatus('offline');
            return;
        }

        setSyncStatus('syncing');

        try {
            // 1. Push local changes to server
            const unsyncedNotes = await db.notes.where('synced').equals(0).toArray();

            for (const note of unsyncedNotes) {
                if (note.isDeleted) {
                    // Try to delete from server
                    try {
                        const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
                        if (res.ok || res.status === 404) {
                            await db.notes.delete(note.id);
                        }
                    } catch (e) { console.error('Delete sync failed', e); }
                } else {
                    // Push update/creation
                    try {
                        const res = await fetch(`/api/notes`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: note.id,
                                title: note.title,
                                content: note.content,
                                updatedAt: note.updatedAt
                            }),
                        });
                        if (res.ok) {
                            await db.notes.update(note.id, { synced: 1 });
                        }
                    } catch (e) { console.error('Update sync failed', e); }
                }
            }

            // 2. Pull changes from server
            const res = await fetch('/api/notes');
            if (res.ok) {
                const serverNotes = await res.json();
                for (const sNote of serverNotes) {
                    const local = await db.notes.get(sNote.id);
                    if (!local || (new Date(sNote.updatedAt) > new Date(local.updatedAt) && local.synced === 1)) {
                        await db.notes.put({
                            ...sNote,
                            synced: 1,
                            isDeleted: 0
                        });
                    }
                }
            }

            setSyncStatus('synced');
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('offline');
        }
    }, []);

    // Periodic Sync
    useEffect(() => {
        runSync();
        const interval = setInterval(runSync, 30000); // Every 30 seconds
        window.addEventListener('online', runSync);
        return () => {
            clearInterval(interval);
            window.removeEventListener('online', runSync);
        };
    }, [runSync]);

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

    // Initial load and persistence of active note
    useEffect(() => {
        const lastId = new URLSearchParams(window.location.search).get('id') || localStorage.getItem('ednotes-active-id');
        if (lastId) {
            db.notes.get(lastId).then(note => {
                if (note && !note.isDeleted) {
                    setActiveNote(note);
                    setTitle(note.title === 'Untitled' ? '' : note.title);
                    setContent(note.content);
                    if (editorRef.current) editorRef.current.innerHTML = note.content;
                }
            });
        }
    }, []);

    useEffect(() => {
        if (activeNote) {
            localStorage.setItem('ednotes-active-id', activeNote.id);
            window.history.replaceState(null, '', `/?id=${activeNote.id}`);
        } else {
            localStorage.removeItem('ednotes-active-id');
            window.history.replaceState(null, '', '/');
        }
    }, [activeNote]);

    // --- Title Sync ---
    useEffect(() => {
        document.title = activeNote && activeNote.title
            ? `${activeNote.title} - Ed's Notes`
            : "Ed's Notes";
    }, [activeNote]);

    // --- Saving Logic ---
    const saveToDB = useCallback(async (noteId: string, noteTitle: string, noteContent: string) => {
        setIsSaving(true);
        const updatedAt = new Date().toISOString();
        await db.notes.update(noteId, {
            title: noteTitle,
            content: noteContent,
            updatedAt,
            synced: 0
        });

        // Update active note record if it's the same
        if (activeNote?.id === noteId) {
            setActiveNote(prev => prev ? { ...prev, title: noteTitle, content: noteContent, updatedAt } : null);
        }

        setTimeout(() => {
            setIsSaving(false);
            runSync(); // Immediate background sync attempt
        }, 500);
    }, [activeNote, runSync]);

    const debouncedSave = useCallback((noteId: string, noteTitle: string, noteContent: string) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveToDB(noteId, noteTitle, noteContent);
        }, 1000);
    }, [saveToDB]);

    // --- Actions ---
    const createNewNote = async () => {
        const newNote: LocalNote = {
            id: uuidv4(),
            title: 'Untitled',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            synced: 0,
            isDeleted: 0
        };
        await db.notes.add(newNote);
        selectNote(newNote);
        if (isMobile) setSidebarOpen(false);
    };

    const confirmDelete = (noteId: string) => {
        setNoteToDelete(noteId);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!noteToDelete) return;

        await db.notes.update(noteToDelete, { isDeleted: 1, synced: 0 });

        if (activeNote?.id === noteToDelete) {
            setActiveNote(null);
            setTitle('');
            setContent('');
            if (editorRef.current) editorRef.current.innerHTML = '';
        }

        setIsDeleteModalOpen(false);
        setNoteToDelete(null);
        runSync(); // Trigger delete sync
    };

    const selectNote = (note: LocalNote) => {
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
                                priority
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

                        const groups: { [key: string]: LocalNote[] } = {
                            'Today': [],
                            'Yesterday': [],
                            'Last 7 Days': [],
                            'This Month': [],
                            'Older': []
                        };

                        sortedNotes.forEach(note => {
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
                                                className="note-actions-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    confirmDelete(note.id);
                                                }}
                                                title="Delete Note"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        ));
                    })()}
                </div>

                {/* Sync Indicator in Sidebar Bottom */}
                <div className="mt-auto p-4 border-t border-[--border] flex items-center gap-2 text-xs text-[--text-muted]">
                    {syncStatus === 'syncing' && <RefreshCcw size={14} className="animate-spin text-blue-400" />}
                    {syncStatus === 'synced' && <Cloud size={14} className="text-green-400" />}
                    {syncStatus === 'offline' && <CloudOff size={14} className="text-amber-400" />}
                    <span className="capitalize">{syncStatus}</span>
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
                            </div>

                            <div
                                ref={editorRef}
                                className="rich-editor"
                                contentEditable
                                suppressContentEditableWarning
                                onInput={handleContentInput}
                                data-placeholder="Start writing..."
                            />

                            {/* Note Meta Info Footer */}
                            <div className="note-meta mt-12 pt-6 border-t border-[--border] text-sm text-[--text-muted]">
                                {formatDate(activeNote.updatedAt)} • {activeNote.content ? activeNote.content.replace(/<[^>]*>/g, '').length : 0} characters
                            </div>
                        </div>

                        <div className={`save-status ${isSaving ? 'visible' : ''}`}>
                            Saving...
                        </div>
                    </>
                ) : (
                    <div className="empty-state">
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
