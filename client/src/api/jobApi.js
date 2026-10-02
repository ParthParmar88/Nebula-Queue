import http from './http'

export const submitJob = (type, payload) =>
  http.post('/api/jobs', { type, payload })

export const getMyJobs = () => http.get('/api/jobs/my')

export const getAllJobs = () => http.get('/api/jobs')

export const getJob = (id) => http.get(`/api/jobs/${encodeURIComponent(id)}`)

export const cancelJob = (id) => http.post(`/api/jobs/${encodeURIComponent(id)}/cancel`)
