import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getThread } from '../domain/get-thread';
import { listThreads } from '../domain/list-threads';
import type { MessageAuthor } from '../domain/message';
import { markRead } from '../domain/mark-read';
import { postMessage } from '../domain/post-message';
import type { ThreadRepository } from '../domain/thread-repository';

export const threadsQueryKey = ['threads'] as const;

export function useThreads(repository: ThreadRepository) {
  return useQuery({ queryKey: threadsQueryKey, queryFn: () => listThreads(repository) });
}

export function useThread(repository: ThreadRepository, id?: string) {
  return useQuery({
    queryKey: [...threadsQueryKey, id],
    queryFn: () => getThread(repository, id as string),
    enabled: id !== undefined,
  });
}

export function usePostMessage(repository: ThreadRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      author,
      text,
    }: {
      threadId: string;
      author: MessageAuthor;
      text: string;
    }) => postMessage(repository, threadId, author, text),
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...threadsQueryKey, thread.id] });
    },
  });
}

export function useMarkRead(repository: ThreadRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => markRead(repository, threadId),
    onSuccess: (thread) => {
      void queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...threadsQueryKey, thread.id] });
    },
  });
}
