import Dexie, { type Table } from 'dexie';

export interface LocalNote {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    synced: 0 | 1; // 0 for unsynced, 1 for synced
    isDeleted: 0 | 1; // 0 for active, 1 for pending deletion
}

export class EdNotesDB extends Dexie {
    notes!: Table<LocalNote>;

    constructor() {
        super('EdNotesDB');
        this.version(1).stores({
            notes: 'id, updatedAt, synced, isDeleted'
        });
    }
}

export const db = new EdNotesDB();
