export class IngestSourceCommand {
  constructor(
    public readonly buffer: Buffer,
    public readonly filename: string,
    public readonly mimeType: string,
    public readonly fileSize: number,
  ) {}
}
