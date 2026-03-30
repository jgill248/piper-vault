export class UpdatePresetCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly persona?: string,
    public readonly model?: string | null,
  ) {}
}
