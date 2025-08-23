import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketMessage, WebSocketMessageType, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  role?: UserRole;
  roomNumber?: string;
  lastPing: number;
}

class WebSocketService {
  private clients: Map<string, ConnectedClient> = new Map();
  private userConnections: Map<string, string[]> = new Map();
  private roomConnections: Map<string, string[]> = new Map();
  private isInitialized: boolean = false;

  constructor(private wss: WebSocketServer) {
    try {
      this.setupWebSocketServer();
      this.startHeartbeat();
      this.isInitialized = true;
      console.log('✅ WebSocket service setup completed');
    } catch (error) {
      console.error('❌ Failed to setup WebSocket service:', error);
      this.isInitialized = false;
    }
  }

  private setupWebSocketServer() {
    if (!this.wss) {
      throw new Error('WebSocket server not available');
    }

    this.wss.on('connection', (ws: WebSocket, request) => {
      try {
        const clientId = uuidv4();
        console.log(`🔗 New WebSocket connection: ${clientId}`);

        const client: ConnectedClient = {
          id: clientId,
          ws,
          lastPing: Date.now()
        };

        this.clients.set(clientId, client);

        // Handle incoming messages
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(clientId, message);
          } catch (error) {
            console.error('Invalid WebSocket message:', error);
            this.sendError(clientId, 'Invalid message format');
          }
        });

        // Handle connection close
        ws.on('close', () => {
          console.log(`🔌 WebSocket connection closed: ${clientId}`);
          this.removeClient(clientId);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`❌ WebSocket error for ${clientId}:`, error);
          this.removeClient(clientId);
        });

        // Handle pong responses
        ws.on('pong', () => {
          const client = this.clients.get(clientId);
          if (client) {
            client.lastPing = Date.now();
          }
        });

        // Send welcome message
        this.sendMessage(clientId, {
          type: WebSocketMessageType.SYSTEM_MESSAGE,
          payload: {
            message: 'Connected to LionKey AI WebSocket server',
            clientId
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error handling new WebSocket connection:', error);
        ws.close();
      }
    });

    // Handle WebSocket server errors
    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'authenticate':
        this.authenticateClient(clientId, message.payload);
        break;
      
      case 'join_room':
        this.joinRoom(clientId, message.payload.room);
        break;
      
      case 'leave_room':
        this.leaveRoom(clientId, message.payload.room);
        break;
      
      case 'ping':
        this.sendMessage(clientId, {
          type: WebSocketMessageType.SYSTEM_MESSAGE,
          payload: { message: 'pong' },
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        console.log(`📨 Received message from ${clientId}:`, message);
    }
  }

  private authenticateClient(clientId: string, payload: { userId: string, role: UserRole, roomNumber?: string }) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.userId = payload.userId;
    client.role = payload.role;
    client.roomNumber = payload.roomNumber;

    // Track user connections
    const userConnections = this.userConnections.get(payload.userId) || [];
    userConnections.push(clientId);
    this.userConnections.set(payload.userId, userConnections);

    // Join room if specified
    if (payload.roomNumber) {
      this.joinRoom(clientId, payload.roomNumber);
    }

    console.log(`🔐 Client authenticated: ${clientId} (User: ${payload.userId}, Role: ${payload.role})`);

    this.sendMessage(clientId, {
      type: WebSocketMessageType.SYSTEM_MESSAGE,
      payload: {
        message: 'Authentication successful',
        userId: payload.userId,
        role: payload.role
      },
      timestamp: new Date().toISOString()
    });
  }

  private joinRoom(clientId: string, room: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const roomConnections = this.roomConnections.get(room) || [];
    if (!roomConnections.includes(clientId)) {
      roomConnections.push(clientId);
      this.roomConnections.set(room, roomConnections);
    }

    console.log(`🏠 Client ${clientId} joined room: ${room}`);

    // Notify room members
    this.broadcastToRoom(room, {
      type: WebSocketMessageType.USER_JOINED,
      payload: {
        userId: client.userId,
        room
      },
      timestamp: new Date().toISOString()
    }, clientId);
  }

  private leaveRoom(clientId: string, room: string) {
    const client = this.clients.get(clientId);
    const roomConnections = this.roomConnections.get(room) || [];
    const index = roomConnections.indexOf(clientId);
    
    if (index > -1) {
      roomConnections.splice(index, 1);
      this.roomConnections.set(room, roomConnections);
    }

    console.log(`🚪 Client ${clientId} left room: ${room}`);

    // Notify room members
    this.broadcastToRoom(room, {
      type: WebSocketMessageType.USER_LEFT,
      payload: {
        userId: client?.userId,
        room
      },
      timestamp: new Date().toISOString()
    });
  }

  private removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user connections
    if (client.userId) {
      const userConnections = this.userConnections.get(client.userId) || [];
      const index = userConnections.indexOf(clientId);
      if (index > -1) {
        userConnections.splice(index, 1);
        if (userConnections.length === 0) {
          this.userConnections.delete(client.userId);
        } else {
          this.userConnections.set(client.userId, userConnections);
        }
      }
    }

    // Remove from all rooms
    for (const [room, connections] of this.roomConnections.entries()) {
      const index = connections.indexOf(clientId);
      if (index > -1) {
        connections.splice(index, 1);
        this.roomConnections.set(room, connections);
        
        // Notify room members
        this.broadcastToRoom(room, {
          type: WebSocketMessageType.USER_LEFT,
          payload: {
            userId: client.userId,
            room
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    this.clients.delete(clientId);
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients.entries()) {
        // Check if client is still alive (30 second timeout)
        if (now - client.lastPing > 30000) {
          console.log(`💀 Client ${clientId} timed out`);
          client.ws.terminate();
          this.removeClient(clientId);
        } else {
          // Send ping
          client.ws.ping();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Public methods for sending messages

  public sendMessage(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  public sendError(clientId: string, error: string) {
    this.sendMessage(clientId, {
      type: WebSocketMessageType.SYSTEM_MESSAGE,
      payload: { error },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastToUser(userId: string, message: WebSocketMessage) {
    const connections = this.userConnections.get(userId) || [];
    connections.forEach(clientId => {
      this.sendMessage(clientId, message);
    });
  }

  public broadcastToRoom(room: string, message: WebSocketMessage, excludeClientId?: string) {
    const connections = this.roomConnections.get(room) || [];
    connections.forEach(clientId => {
      if (clientId !== excludeClientId) {
        this.sendMessage(clientId, message);
      }
    });
  }

  public broadcastToRole(role: UserRole, message: WebSocketMessage) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.role === role) {
        this.sendMessage(clientId, message);
      }
    }
  }

  public broadcastToAll(message: WebSocketMessage) {
    for (const clientId of this.clients.keys()) {
      this.sendMessage(clientId, message);
    }
  }

  public getStats() {
    return {
      totalConnections: this.clients.size,
      authenticatedUsers: this.userConnections.size,
      activeRooms: this.roomConnections.size,
      connectionsByRole: Array.from(this.clients.values()).reduce((acc, client) => {
        if (client.role) {
          acc[client.role] = (acc[client.role] || 0) + 1;
        }
        return acc;
      }, {} as Record<UserRole, number>)
    };
  }

  // Check if service is initialized
  isServiceReady(): boolean {
    return this.isInitialized && this.wss !== null;
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.isInitialized,
      clientsCount: this.clients.size,
      userConnectionsCount: this.userConnections.size,
      roomConnectionsCount: this.roomConnections.size
    };
  }
}

let wsService: WebSocketService;

export const initializeWebSocket = (wss: WebSocketServer): WebSocketService => {
  wsService = new WebSocketService(wss);
  return wsService;
};

export const getWebSocketService = (): WebSocketService | null => {
  if (!wsService || !wsService.isServiceReady()) {
    return null;
  }
  return wsService;
};

export default WebSocketService;
