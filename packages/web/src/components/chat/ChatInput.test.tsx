import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  afterEach(cleanup);

  it('renders the input and submit button', () => {
    render(
      <ChatInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText('Enter query...')).toBeDefined();
    expect(screen.getByText('EXECUTE_')).toBeDefined();
  });

  it('calls onSubmit when Enter is pressed with non-empty value', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(
      <ChatInput value="hello" onChange={onChange} onSubmit={onSubmit} />,
    );
    const textarea = screen.getByPlaceholderText('Enter query...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit when Shift+Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(
      <ChatInput value="hello" onChange={vi.fn()} onSubmit={onSubmit} />,
    );
    const textarea = screen.getByPlaceholderText('Enter query...');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the submit button when value is empty', () => {
    render(
      <ChatInput value="" onChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    const button = screen.getByText('EXECUTE_');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables input and button when disabled prop is true', () => {
    render(
      <ChatInput value="hello" onChange={vi.fn()} onSubmit={vi.fn()} disabled={true} />,
    );
    const textarea = screen.getByPlaceholderText('Enter query...');
    const button = screen.getByText('EXECUTE_');
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
