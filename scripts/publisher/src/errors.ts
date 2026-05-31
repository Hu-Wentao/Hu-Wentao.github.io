export class PublisherError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PublisherError";
  }
}
