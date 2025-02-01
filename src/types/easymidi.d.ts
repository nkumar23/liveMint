declare module 'easymidi' {
  export class Input {
    constructor(name: string);
    static getPortNames(): string[];
    close(): void;
    on(event: 'noteon' | 'noteoff', callback: (msg: { note: number, velocity: number, channel: number }) => void): void;
  }

  export class Output {
    constructor(name: string);
    static getPortNames(): string[];
    close(): void;
    send(event: string, message: { note: number, velocity: number, channel: number }): void;
  }
} 