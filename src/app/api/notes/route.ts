import { db } from '@/lib/db';
import { notes } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

// GET all notes
export async function GET() {
    try {
        const allNotes = await db.select().from(notes).orderBy(desc(notes.updatedAt));
        return NextResponse.json(allNotes);
    } catch (error) {
        console.error('Failed to fetch notes:', error);
        return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }
}

// POST create new note
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, content } = body;

        const newNote = await db.insert(notes).values({
            title: title || 'Untitled',
            content: content || '',
        }).returning();

        return NextResponse.json(newNote[0]);
    } catch (error) {
        console.error('Failed to create note:', error);
        return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }
}
