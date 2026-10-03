import { useEffect, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// Admins get every job's updates; everyone else only their own jobs.
const DESTINATIONS = {
  user: { jobs: '/user/queue/jobs', stream: '/user/queue/job-stream' },
  admin: { jobs: '/topic/admin/jobs', stream: '/topic/admin/job-stream' },
}

/**
 * Subscribes to live job updates (each message is the full job) and to the text stream of
 * AI jobs (`{ jobId, seq, delta }`). Returns whether the socket is currently connected.
 */
export function useJobSocket({ token, isAdmin, onJobUpdate, onStreamDelta }) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return
    const destinations = isAdmin ? DESTINATIONS.admin : DESTINATIONS.user

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      // The API authenticates the STOMP CONNECT frame with the same JWT as REST calls
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        setConnected(true)
        client.subscribe(destinations.jobs, (message) => onJobUpdate(JSON.parse(message.body)))
        client.subscribe(destinations.stream, (message) => onStreamDelta(JSON.parse(message.body)))
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => console.error('🔌 WebSocket error:', frame.headers.message),
      reconnectDelay: 5000,  // auto reconnect after 5s
    })

    client.activate()
    return () => {
      setConnected(false)
      client.deactivate()  // cleanup on logout/unmount
    }
  }, [token, isAdmin, onJobUpdate, onStreamDelta])

  return connected
}
