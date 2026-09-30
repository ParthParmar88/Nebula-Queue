import { useEffect } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

export function useJobSocket(onStatusUpdate) {
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      onConnect: () => {
        console.log('🔌 WebSocket connected')
        // Listen for status updates from Spring Boot
        client.subscribe('/topic/jobs', (message) => {
          const update = JSON.parse(message.body)
          onStatusUpdate(update)  // { jobId, status }
        })
      },
      onDisconnect: () => console.log('🔌 WebSocket disconnected'),
      reconnectDelay: 5000,  // auto reconnect after 5s
    })

    client.activate()
    return () => client.deactivate()  // cleanup on unmount
  }, [onStatusUpdate])
}