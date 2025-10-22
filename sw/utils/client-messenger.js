// Client Communication Utility
// Handles messaging with service worker clients

/**
 * Broadcast message to all clients
 * @param {Object} message - Message to broadcast
 * @returns {Promise<void>}
 */
export async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll();
    console.log('[SW] Broadcasting to', clients.length, 'clients:', message.type);

    clients.forEach(client => {
      try {
        client.postMessage(message);
      } catch (error) {
        console.error('[SW] Failed to send message to client:', error);
      }
    });
  } catch (error) {
    console.error('[SW] Failed to broadcast message:', error);
  }
}

/**
 * Send response through message channel or direct client message
 * @param {Event} event - Message event
 * @param {Object} response - Response to send
 */
export function sendResponse(event, response) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(response);
  } else {
    // Fallback for clients.postMessage
    event.source?.postMessage(response);
  }
}
