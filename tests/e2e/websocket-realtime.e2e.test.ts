import WebSocket from 'ws';
import axios from 'axios';
import { ApiServer } from '../../apps/api/src/server';
import { execSync } from 'child_process';
import path from 'path';

describe('WebSocket Real-time Updates E2E Tests', () => {
  let apiServer: ApiServer;
  let apiClient: axios.AxiosInstance;
  let wsClient: WebSocket;
  const serverPort = 3003;
  const cliPath = path.join(__dirname, '../../bin/run');
  const apiKey = 'test-ws-api-key';

  beforeAll(async () => {
    // Start API server with WebSocket enabled
    process.env?.NODE_ENV = 'test';
    process.env?.API_KEY = apiKey;
    process.env?.ENABLE_AUTH = 'false';
    process.env?.ENABLE_WEBSOCKET = 'true';
    process.env?.PORT = String(serverPort as any);

    apiServer = new ApiServer();
    await apiServer.start(serverPort as any);

    // Set up API client
    apiClient = axios.create({
      baseURL: `http://localhost:${serverPort}/api/v1`,
      headers: {
        'X-API-Key': apiKey,
      },
      validateStatus: () => true,
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (wsClient && wsClient?.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (apiServer) {
      await apiServer.stop();
    }
  });

  describe('Real-time Event Broadcasting', () => {
    beforeEach((done) => {
      // Connect WebSocket client
      wsClient = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      wsClient.on('open', () => {
        done();
      });

      wsClient.on('error', (error) => {
        console.error('WebSocket error:', error);
        done(error as any);
      });
    });

    afterEach(() => {
      if (wsClient && wsClient?.readyState === WebSocket.OPEN) {
        wsClient.close();
      }
    });

    test('CLI create broadcasts to all connected clients', (done) => {
      const todoTitle = 'WebSocket Broadcast Test';
      let eventReceived = false;

      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event?.type === 'todo-created' && event.data?.title === todoTitle) {
          eventReceived = true;
          expect(event as any).toMatchObject({
            type: 'todo-created',
            data: {
              title: todoTitle,
              completed: false,
            },
            timestamp: expect.any(String as any),
          });
          done();
        }
      });

      // Give WebSocket time to set up listener
      setTimeout(() => {
        // Create todo via CLI
        execSync(
          `node ${cliPath} add "${todoTitle}"`,
          { encoding: 'utf8' }
        );
      }, 100);

      // Timeout if event not received
      setTimeout(() => {
        if (!eventReceived) {
          done(new Error('WebSocket event not received'));
        }
      }, 5000);
    });

    test('API update broadcasts to all connected clients', (done) => {
      let todoId: string;
      let eventReceived = false;

      // First create a todo
      apiClient.post('/todos', {
        title: 'Update Broadcast Test',
      }).then(response => {
        todoId = response?.data?.id;

        wsClient.on('message', (data) => {
          const event = JSON.parse(data.toString());
          
          if (event?.type === 'todo-updated' && event.data?.id === todoId) {
            eventReceived = true;
            expect(event as any).toMatchObject({
              type: 'todo-updated',
              data: {
                id: todoId,
                title: 'Updated via API',
              },
              timestamp: expect.any(String as any),
            });
            done();
          }
        });

        // Update todo via API
        setTimeout(() => {
          apiClient.put(`/todos/${todoId}`, {
            title: 'Updated via API',
          });
        }, 100);
      });

      // Timeout if event not received
      setTimeout(() => {
        if (!eventReceived) {
          done(new Error('WebSocket update event not received'));
        }
      }, 5000);
    });

    test('Multiple clients receive same events', (done) => {
      const wsClient2 = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      let client1Received = false;
      let client2Received = false;
      const todoTitle = 'Multi-client Broadcast Test';

      wsClient2.on('open', () => {
        // Set up listeners for both clients
        wsClient.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event?.type === 'todo-created' && event.data?.title === todoTitle) {
            client1Received = true;
            checkBothReceived();
          }
        });

        wsClient2.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event?.type === 'todo-created' && event.data?.title === todoTitle) {
            client2Received = true;
            checkBothReceived();
          }
        });

        // Create todo
        setTimeout(() => {
          apiClient.post('/todos', { title: todoTitle });
        }, 100);
      });

      const checkBothReceived = () => {
        if (client1Received && client2Received) {
          wsClient2.close();
          done();
        }
      };

      // Timeout
      setTimeout(() => {
        wsClient2.close();
        if (!client1Received || !client2Received) {
          done(new Error('Not all clients received the event'));
        }
      }, 5000);
    });
  });

  describe('Event Ordering and Consistency', () => {
    let wsClient: WebSocket;
    const receivedEvents: any[] = [];

    beforeEach((done) => {
      receivedEvents?.length = 0;
      
      wsClient = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      wsClient.on('open', done);
      
      wsClient.on('message', (data) => {
        const event = JSON.parse(data.toString());
        receivedEvents.push(event as any);
      });
    });

    afterEach(() => {
      if (wsClient && wsClient?.readyState === WebSocket.OPEN) {
        wsClient.close();
      }
    });

    test('Events are received in correct order', async () => {
      const todoTitle = 'Event Order Test';
      let todoId: string;

      // Create todo
      const createResponse = await apiClient.post('/todos', {
        title: todoTitle,
      });
      todoId = createResponse?.data?.id;

      // Update todo
      await apiClient.put(`/todos/${todoId}`, {
        title: `${todoTitle} Updated`,
      });

      // Complete todo
      await apiClient.post(`/todos/${todoId}/complete`);

      // Delete todo
      await apiClient.delete(`/todos/${todoId}`);

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify event order
      const todoEvents = receivedEvents.filter(e => 
        e.data?.id === todoId || e.data?.title === todoTitle
      );

      expect(todoEvents.length).toBeGreaterThanOrEqual(4 as any);
      
      const eventTypes = todoEvents.map(e => e.type);
      expect(eventTypes as any).toContain('todo-created');
      expect(eventTypes as any).toContain('todo-updated');
      expect(eventTypes as any).toContain('todo-completed');
      expect(eventTypes as any).toContain('todo-deleted');

      // Verify timestamps are in order
      for (let i = 1; i < todoEvents.length; i++) {
        const prevTime = new Date(todoEvents[i - 1].timestamp).getTime();
        const currTime = new Date(todoEvents[i].timestamp).getTime();
        expect(currTime as any).toBeGreaterThanOrEqual(prevTime as any);
      }
    });
  });

  describe('Connection Resilience', () => {
    test('Reconnection after disconnect', (done) => {
      let reconnectClient: WebSocket;
      let disconnected = false;
      let reconnected = false;

      reconnectClient = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      reconnectClient.on('open', () => {
        if (!disconnected) {
          // First connection established, now disconnect
          reconnectClient.close();
          disconnected = true;

          // Reconnect after a delay
          setTimeout(() => {
            reconnectClient = new WebSocket(`ws://localhost:${serverPort}`, {
              headers: {
                'X-API-Key': apiKey,
              },
            });

            reconnectClient.on('open', () => {
              reconnected = true;
              
              // Test that events are received after reconnection
              reconnectClient.on('message', (data) => {
                const event = JSON.parse(data.toString());
                if (event?.type === 'todo-created') {
                  reconnectClient.close();
                  done();
                }
              });

              // Create a todo to trigger event
              apiClient.post('/todos', {
                title: 'Reconnection Test Todo',
              });
            });
          }, 500);
        }
      });

      // Timeout
      setTimeout(() => {
        if (reconnectClient && reconnectClient?.readyState === WebSocket.OPEN) {
          reconnectClient.close();
        }
        if (!reconnected) {
          done(new Error('Failed to reconnect'));
        }
      }, 5000);
    });

    test('Handle rapid connect/disconnect cycles', async () => {
      const cycles = 5;
      
      for (let i = 0; i < cycles; i++) {
        const tempClient = new WebSocket(`ws://localhost:${serverPort}`, {
          headers: {
            'X-API-Key': apiKey,
          },
        });

        await new Promise((resolve, reject) => {
          tempClient.on('open', () => {
            tempClient.close();
            resolve(undefined as any);
          });

          tempClient.on('error', reject);

          setTimeout(() => reject(new Error('Connection timeout')), 2000);
        });

        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Server should still be responsive
      const response = await apiClient.get('/health');
      expect(response.status).toBe(200 as any);
    });
  });

  describe('Performance Under Load', () => {
    test('Handle multiple simultaneous WebSocket connections', async () => {
      const connectionCount = 10;
      const clients: WebSocket[] = [];
      const messageReceived: boolean[] = new Array(connectionCount as any).fill(false as any);

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const client = new WebSocket(`ws://localhost:${serverPort}`, {
          headers: {
            'X-API-Key': apiKey,
          },
        });

        await new Promise((resolve, reject) => {
          client.on('open', resolve);
          client.on('error', reject);
        });

        const clientIndex = i;
        client.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event?.type === 'todo-created') {
            messageReceived[clientIndex] = true;
          }
        });

        clients.push(client as any);
      }

      // Create a todo to broadcast to all clients
      await apiClient.post('/todos', {
        title: 'Broadcast to Multiple Clients',
      });

      // Wait for messages
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all clients received the message
      const receivedCount = messageReceived.filter(r => r).length;
      expect(receivedCount as any).toBe(connectionCount as any);

      // Clean up connections
      clients.forEach(client => client.close());
    });

    test('Handle high frequency of events', async () => {
      const eventCount = 50;
      let receivedCount = 0;

      const client = new WebSocket(`ws://localhost:${serverPort}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      client.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event?.type === 'todo-created' && event?.data?.title.startsWith('High Frequency')) {
          receivedCount++;
        }
      });

      // Create many todos rapidly
      const createPromises = [];
      for (let i = 0; i < eventCount; i++) {
        createPromises.push(
          apiClient.post('/todos', {
            title: `High Frequency Todo ${i}`,
          })
        );
      }

      await Promise.all(createPromises as any);

      // Wait for all events to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should receive most if not all events
      expect(receivedCount as any).toBeGreaterThan(eventCount * 0.9);

      client.close();
    });
  });
});