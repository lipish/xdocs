import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '@/lib/api';

export type PermissionType = 'public' | 'private' | 'specific';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  notes: string;
  ownerId: string;
  ownerName: string;
  permission: PermissionType;
  allowedUsers: string[]; // User IDs for specific permission
  isGenerated: boolean;
  downloadPreauthorized: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentContextType {
  documents: Document[];
  myDocuments: Document[];
  accessibleDocuments: Document[];
  uploadDocument: (file: File, notes?: string) => Promise<Document>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<boolean>;
  getDocument: (id: string) => Document | undefined;
  saveGeneratedDocument: (name: string, content: string, notes?: string) => Document;
  canAccess: (doc: Document) => boolean;
  canEdit: (doc: Document) => boolean;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      return;
    }
    apiFetch<Document[]>('/documents')
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [user?.id]);

  const canAccess = (doc: Document): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    if (doc.ownerId === user.id) return true;
    if (doc.permission === 'public') return true;
    if (doc.permission === 'specific' && doc.allowedUsers.includes(user.id)) return true;
    return false;
  };

  const canEdit = (doc: Document): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    if (doc.ownerId === user.id) return true;
    return false;
  };

  const uploadDocument = async (file: File, notes: string = ''): Promise<Document> => {
    if (!user) {
      throw new Error('Must be logged in');
    }

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('notes', notes);

    const created = await apiFetch<Document>('/documents', {
      method: 'POST',
      body: form,
    });
    setDocuments((prev) => [created, ...prev]);
    return created;
  };

  const updateDocument = async (id: string, updates: Partial<Document>): Promise<boolean> => {
    const doc = documents.find(d => d.id === id);
    if (!doc || !canEdit(doc)) return false;

    const body: any = {};
    if (typeof updates.name === 'string') body.name = updates.name;
    if (typeof updates.notes === 'string') body.notes = updates.notes;
    if (typeof updates.permission === 'string') body.permission = updates.permission;
    if (Array.isArray(updates.allowedUsers)) body.allowedUsers = updates.allowedUsers;
    if (typeof updates.downloadPreauthorized === 'boolean') body.downloadPreauthorized = updates.downloadPreauthorized;

    try {
      const updated = await apiFetch<Document>(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: body.name,
          notes: body.notes,
          permission: body.permission,
          allowed_users: body.allowedUsers,
          download_preauthorized: body.downloadPreauthorized,
        }),
      });
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return true;
    } catch {
      return false;
    }
  };

  const deleteDocument = async (id: string): Promise<boolean> => {
    const doc = documents.find(d => d.id === id);
    if (!doc || !canEdit(doc)) return false;

    try {
      await apiFetch<void>(`/documents/${id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const getDocument = (id: string): Document | undefined => {
    const doc = documents.find(d => d.id === id);
    if (doc && canAccess(doc)) return doc;
    return undefined;
  };

  const saveGeneratedDocument = (name: string, content: string, notes: string = ''): Document => {
    if (!user) throw new Error('Must be logged in');

    const file = new File([content], name.endsWith('.md') ? name : `${name}.md`, { type: 'text/markdown' });
    const form = new FormData();
    form.append('file', file);
    form.append('notes', notes);
    form.append('is_generated', 'true');

    apiFetch<Document>('/documents', {
      method: 'POST',
      body: form,
    })
      .then((created) => setDocuments((prev) => [created, ...prev]))
      .catch(() => {});

    return {
      id: `pending-${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      notes,
      ownerId: user.id,
      ownerName: user.username,
      permission: 'public',
      allowedUsers: [],
      isGenerated: true,
      downloadPreauthorized: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const myDocuments = documents.filter(d => user && d.ownerId === user.id);
  const accessibleDocuments = documents.filter(d => canAccess(d));

  return (
    <DocumentContext.Provider
      value={{
        documents,
        myDocuments,
        accessibleDocuments,
        uploadDocument,
        updateDocument,
        deleteDocument,
        getDocument,
        saveGeneratedDocument,
        canAccess,
        canEdit,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
}
