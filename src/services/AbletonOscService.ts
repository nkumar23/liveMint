import * as osc from 'node-osc';

export class AbletonOscService {
  private client: osc.Client;

  constructor() {
    this.client = new osc.Client('127.0.0.1', 9000);
  }

  async triggerExport(): Promise<string> {
    // Send OSC message to Max/M4L device
    this.client.send('/ableton/export', 1);
    return new Promise((resolve) => {
      // Listen for completion message
    });
  }
} 