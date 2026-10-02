import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelJob, getAllJobs, getJob, getMyJobs, submitJob } from '../api/jobApi'
import { useAuth } from '../context/authContext.js'

/*
 * Server state for jobs lives in the React Query cache. REST loads it; WebSocket messages
 * and mutation responses are merged into it with `useApplyJobUpdate`, so every page
 * (overview, list, detail) updates live from one source of truth.
 *
 * Keys include the user's email so one account never sees another's cached jobs after
 * switching accounts in the same tab.
 */

function listKey(email, isAdmin) {
  return ['jobs', email, isAdmin ? 'all' : 'mine']
}

function detailKey(email, id) {
  return ['job', email, id]
}

/** Prefer whichever copy of a job is newer — socket messages can arrive before a POST response. */
function newer(a, b) {
  if (!a) return b
  if (!b) return a
  return new Date(b.updatedAt ?? 0) >= new Date(a.updatedAt ?? 0) ? b : a
}

/** Jobs visible to the current user (all jobs for admins), newest first. */
export function useJobsQuery() {
  const { email, isAdmin } = useAuth()
  return useQuery({
    queryKey: listKey(email, isAdmin),
    queryFn: async () => (isAdmin ? await getAllJobs() : await getMyJobs()).data,
  })
}

export function useJobQuery(id) {
  const { email, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: detailKey(email, id),
    queryFn: async () => (await getJob(id)).data,
    // Show the row we already have from the list instantly, then refresh in the background
    initialData: () => queryClient.getQueryData(listKey(email, isAdmin))?.find((job) => job.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(listKey(email, isAdmin))?.dataUpdatedAt,
  })
}

/** Merge a job (from the socket or a mutation) into the list and detail caches. */
export function useApplyJobUpdate() {
  const { email, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  return useCallback(
    (job) => {
      queryClient.setQueryData(listKey(email, isAdmin), (list) => {
        if (!list) return list
        const index = list.findIndex((j) => j.id === job.id)
        if (index === -1) return [job, ...list]
        const merged = newer(list[index], job)
        if (merged === list[index]) return list
        const next = list.slice()
        next[index] = merged
        return next
      })
      queryClient.setQueryData(detailKey(email, job.id), (current) => newer(current, job))
    },
    [queryClient, email, isAdmin]
  )
}

export function useSubmitJob() {
  const applyJobUpdate = useApplyJobUpdate()
  return useMutation({
    mutationFn: async ({ type, payload }) => (await submitJob(type, payload)).data,
    onSuccess: applyJobUpdate,
  })
}

export function useCancelJob() {
  const applyJobUpdate = useApplyJobUpdate()
  return useMutation({
    mutationFn: async (id) => (await cancelJob(id)).data,
    onSuccess: applyJobUpdate,
  })
}
