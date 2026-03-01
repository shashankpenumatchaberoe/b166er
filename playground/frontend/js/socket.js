/**
 * socket.js — Socket.IO client wrapper.
 * Uses a relative connection (no hardcoded URL) so it always targets
 * whichever server served the page.
 */

class SocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this._connected = false;
    this._socketListenersRegistered = false;
  }

  connect() {
    // Prevent multiple connections
    if (this.socket && this._socketListenersRegistered) {
      console.warn('[Socket] Already connected, skipping duplicate connection');
      return;
    }

    this._emit('_connecting');

    // No URL → connects to the same origin that served the page.
    // The server also serves /socket.io/socket.io.js so versions always match.
    // eslint-disable-next-line no-undef
    this.socket = io({
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: Infinity,
      timeout: 5000,
    });

    // Only register socket.io event listeners once
    if (!this._socketListenersRegistered) {
      this.socket.on('connect', () => {
        this._connected = true;
        this._emit('_connected');
      });

      this.socket.on('disconnect', (reason) => {
        this._connected = false;
        this._emit('_disconnected', reason);
      });

      this.socket.on('connect_error', (err) => {
        this._connected = false;
        this._emit('_connect_error', err.message);
        console.warn('[Socket] Connection error:', err.message);
      });

      this.socket.on('reconnect_attempt', (n) => {
        this._emit('_reconnecting', n);
      });

      ['terminal:output', 'terminal:created', 'terminal:agent_exit', 'terminal:error', 'history:updated']
        .forEach((ev) => {
          this.socket.on(ev, (data) => this._emit(ev, data));
        });

      this._socketListenersRegistered = true;
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    const handlers = this.listeners.get(event);
    // Prevent duplicate handler registration
    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter((h) => h !== handler));
  }

  emit(event, data) {
    if (!this.socket || !this._connected) return;
    this.socket.emit(event, data);
  }

  _emit(event, data) {
    (this.listeners.get(event) ?? []).forEach((h) => h(data));
  }

  isConnected() { return this._connected; }
}

window.socketManager = new SocketManager();
