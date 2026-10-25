import { env } from '../../config/env';

export class KeepAliveService {
  private static timer: NodeJS.Timeout | null = null;
  private static readonly PING_INTERVAL_MS = 9 * 60 * 1000; // 9 minutes (Render sleeps at 15m)

  /**
   * Starts periodic self-ping to keep the free-tier server continuously awake
   */
  public static start(): void {
    if (this.timer) return;

    const targetBaseUrl =
      env.RENDER_EXTERNAL_URL ||
      env.SELF_PING_URL ||
      `http://localhost:${env.PORT}`;

    const cleanBaseUrl = targetBaseUrl.replace(/\/+$/, '');
    const pingUrl = `${cleanBaseUrl}/health`;

    console.log(`[KeepAlive]: Keep-Alive heartbeat service initialized for: ${pingUrl}`);
    console.log(`[KeepAlive]: Ping frequency set to every 9 minutes to prevent sleep.`);

    // Initial ping after 5 seconds of startup
    setTimeout(() => {
      this.pingServer(pingUrl);
    }, 5000);

    // Periodic ping loop
    this.timer = setInterval(() => {
      this.pingServer(pingUrl);
    }, this.PING_INTERVAL_MS);
  }

  /**
   * Executes a health check HTTP GET request
   */
  private static async pingServer(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Snapie-KeepAlive-Ping/1.0',
        },
      });

      if (response.ok) {
        console.log(`[KeepAlive]: Heartbeat ping sent successfully to ${url} (Status: ${response.status} - Server Awake)`);
      } else {
        console.warn(`[KeepAlive]: Ping returned non-200 status: ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[KeepAlive]: Ping attempt notice: ${err.message}`);
    }
  }

  /**
   * Stops the keep-alive timer on server shutdown
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[KeepAlive]: Service stopped.');
    }
  }
}
