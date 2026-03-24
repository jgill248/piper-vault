import { z } from 'zod';

export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(0),
  collectionId: z.string().uuid().optional(),
  parentPath: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateNoteDto = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  content: z.string().optional(),
  title: z.string().min(1).max(500).optional(),
  parentPath: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateNoteDto = z.infer<typeof UpdateNoteSchema>;

export const CreateFolderSchema = z.object({
  path: z.string().min(1).max(500),
  collectionId: z.string().uuid().optional(),
});

export type CreateFolderDto = z.infer<typeof CreateFolderSchema>;

export const RenameFolderSchema = z.object({
  newPath: z.string().min(1).max(500),
});

export type RenameFolderDto = z.infer<typeof RenameFolderSchema>;
