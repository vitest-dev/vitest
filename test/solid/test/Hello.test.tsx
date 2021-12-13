import { afterEach, describe, expect, test } from 'vitest';
import { render, fireEvent, cleanup } from 'solid-testing-library';
import { Hello } from '../components/Hello';

describe('Solid.js Hello.tsx', () => {
  afterEach(cleanup);

  test('mounts', () => {
    const { container } = render(() => <Hello count={4} />);
    expect(container).toBeTruthy();
    expect(container.innerHTML).toContain('4 x 2 = 8');
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('updates on button click', async () => {
    const { getByText, getByRole } = render(() => <Hello count={4} />);
    const btn = getByRole('button') as HTMLButtonElement;
    const div = getByText('4 x 2 = 8') as HTMLDivElement;
    fireEvent.click(btn);
    await Promise.resolve();
    expect(div.innerHTML).toBe('4 x 3 = 12');
    fireEvent.click(btn);
    await Promise.resolve();
    expect(div.innerHTML).toBe('4 x 4 = 16');
  });
})