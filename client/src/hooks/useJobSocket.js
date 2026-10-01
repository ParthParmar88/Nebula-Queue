import { useEffect, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// Admins get every job's updates; everyone else only their own jobs.
const USER_DESTINATION = '/user/queue/jobs'
const ADMIN_DESTINATION = '/topic/admin/jobs'

/**
 * Subscribes to live job updates. Each message is the full job object.
 * Returns whether the socket is currently connected.
 */
export function useJobSocket({ token, isAdmin, onJobUpdate }) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      // The API authenticates the STOMP CONNECT frame with the same JWT as REST calls
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        setConnected(true)
        client.subscribe(isAdmin ? ADMIN_DESTINATION : USER_DESTINATION, (message) => {
          onJobUpdate(JSON.parse(message.body))
        })
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
  }, [token, isAdmin, onJobUpdate])

  return connected
}
