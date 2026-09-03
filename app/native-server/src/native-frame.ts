export const MAX_NATIVE_MESSAGE_SIZE_BYTES = 16 * 1024 * 1024;
export const MAX_NATIVE_MESSAGES_PER_READ = 100;

/** Decodes Chrome Native Messaging's little-endian length-prefixed stream. */
export class NativeMessageFrameDecoder {
  private buffer = Buffer.alloc(0);
  private expectedLength = -1;

  append(chunk: Buffer): void {
    if (chunk.length) this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  readMessages(limit = MAX_NATIVE_MESSAGES_PER_READ): Buffer[] {
    const messages: Buffer[] = [];
    while (messages.length < limit) {
      if (this.expectedLength === -1) {
        if (this.buffer.length < 4) break;
        this.expectedLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.subarray(4);
        const length = this.expectedLength;
        if (length <= 0 || length > MAX_NATIVE_MESSAGE_SIZE_BYTES) {
          this.reset();
          throw new Error(`Invalid message length: ${length}`);
        }
      }

      if (this.buffer.length < this.expectedLength) break;
      messages.push(this.buffer.subarray(0, this.expectedLength));
      this.buffer = this.buffer.subarray(this.expectedLength);
      this.expectedLength = -1;
    }
    return messages;
  }

  hasCompleteMessage(): boolean {
    if (this.expectedLength === -1) {
      if (this.buffer.length < 4) return false;
      const length = this.buffer.readUInt32LE(0);
      return (
        length > 0 && length <= MAX_NATIVE_MESSAGE_SIZE_BYTES && this.buffer.length - 4 >= length
      );
    }
    return this.buffer.length >= this.expectedLength;
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
    this.expectedLength = -1;
  }
}
