/**
 * Suppress Windows-specific console warnings from node-pty.
 * Must be imported before any other modules.
 */

if (process.platform === 'win32') {
  // Override console.error to filter AttachConsole warnings
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('AttachConsole') || message.includes('attach')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Override process.stderr.write more aggressively
  const originalWrite = process.stderr.write.bind(process.stderr);
  (process.stderr.write as any) = (
    chunk: any,
    encodingOrCallback?: any,
    callback?: any
  ): boolean => {
    const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined;
    const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;

    const str = chunk?.toString?.() || '';
    if (str.includes('AttachConsole') || str.includes('attach')) {
      if (cb) cb();
      return true;
    }

    if (encoding) {
      return originalWrite(chunk, encoding as BufferEncoding, cb);
    }
    return originalWrite(chunk, cb);
  };
}

export {};
