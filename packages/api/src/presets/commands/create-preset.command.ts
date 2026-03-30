export class CreatePresetCommand {
  constructor(
    public readonly name: string,
    public readonly persona: string,
    public readonly model?: string,
  ) {}
}
