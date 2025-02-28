import { TriggerListener } from './TriggerListener';
import express from 'express';
import crypto from 'crypto';

export interface IftttTriggerConfig {
  eventName: string;
  secretKey?: string;  // Optional secret key for verification
}

export class IftttTriggerListener implements TriggerListener {
  private config: IftttTriggerConfig;
  private callback: (timestamp: Date) => void;
  private app: express.Application;
  private secretKey: string;

  constructor(config: IftttTriggerConfig, callback: (timestamp: Date) => void, app: express.Application) {
    this.config = config;
    this.callback = callback;
    this.app = app;
    
    // Generate a secret key if not provided
    this.secretKey = config.secretKey || crypto.randomBytes(16).toString('hex');
  }

  async start(): Promise<void> {
    console.log(`Setting up IFTTT webhook listener for event: ${this.config.eventName}`);
    console.log(`Secret key: ${this.config.secretKey || 'none'}`);
    
    // Create the webhook endpoint
    this.app.post(`/api/webhook/ifttt/${this.config.eventName}`, (req, res) => {
      console.log(`Received IFTTT webhook for event: ${this.config.eventName}`);
      console.log('Request body:', JSON.stringify(req.body));
      console.log('Request headers:', JSON.stringify(req.headers));
      
      // Verify secret key if provided
      const providedKey = req.query.key || req.headers['x-ifttt-key'];
      if (this.config.secretKey && providedKey !== this.config.secretKey) {
        console.error('Invalid secret key provided');
        console.error(`Expected: ${this.config.secretKey}, Got: ${providedKey}`);
        return res.status(401).json({ error: 'Invalid secret key' });
      }
      
      // Trigger the callback
      console.log('Triggering callback...');
      this.callback(new Date());
      
      // Respond to IFTTT
      res.json({ success: true, message: 'Webhook received and processed' });
    });
    
    console.log(`IFTTT webhook URL: /api/webhook/ifttt/${this.config.eventName}${this.config.secretKey ? `?key=${this.secretKey}` : ''}`);
  }

  async stop(): Promise<void> {
    console.log(`Stopping IFTTT webhook listener for event: ${this.config.eventName}`);
    // No need to explicitly stop anything as Express will handle this
    return Promise.resolve();
  }

  getWebhookUrl(): string {
    return `/api/webhook/ifttt/${this.config.eventName}${this.config.secretKey ? `?key=${this.secretKey}` : ''}`;
  }
} 