import { db } from '@/lib/db';
import { notes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

// GET single note
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const note = await db.select().from(notes).where(eq(notes.id, id));

        if (note.length === 0) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json(note[0]);
    } catch (error) {
        console.error('Failed to fetch note:', error);
        return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
    }
}

// PUT update note
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { title, content } = body;

        const updatedNote = await db.update(notes)
            .set({
                title,
                content,
                updatedAt: new Date(),
            })
            .where(eq(notes.id, id))
            .returning();

        if (updatedNote.length === 0) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json(updatedNote[0]);
    } catch (error) {
        console.error('Failed to update note:', error);
        return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }
}

// DELETE note
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const deletedNote = await db.delete(notes)
            .where(eq(notes.id, id))
            .returning();

        if (deletedNote.length === 0) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Failed to delete note:', error);
        return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }
}
