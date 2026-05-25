import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import GuidanceModal from './GuidanceModal';

afterEach(() => cleanup());

describe('GuidanceModal', () => {
  it('renders the stage title and plain-text guidance', () => {
    render(<GuidanceModal title="第1关" guidance="hello world" onStart={() => {}} />);
    expect(screen.getByText('第1关')).toBeTruthy();
    expect(screen.getByText('hello world')).toBeTruthy();
  });

  it('renders markdown bold as <strong>', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance="this is **bold**" onStart={() => {}} />
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders markdown lists as <ul><li>', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance={'- alpha\n- beta'} onStart={() => {}} />
    );
    const items = container.querySelectorAll('ul > li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('alpha');
    expect(items[1].textContent).toBe('beta');
  });

  it('renders markdown links as <a href> opening new tab', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance="[click](https://example.com)" onStart={() => {}} />
    );
    const a = container.querySelector('a');
    expect(a).toBeTruthy();
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });

  it('does NOT render raw HTML (XSS-safe by default)', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance={'<script>alert(1)</script>safe text'} onStart={() => {}} />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('safe text');
  });

  it('renders images as constrained <img> elements', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance="![diagram](https://example.com/x.png)" onStart={() => {}} />
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/x.png');
    expect(img?.getAttribute('alt')).toBe('diagram');
    expect(img?.style.maxWidth).toBe('100%');
    expect(img?.style.height).toBe('auto');
  });

  it('treats single newlines as hard breaks (remark-breaks)', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance={'line1\nline2'} onStart={() => {}} />
    );
    const breaks = container.querySelectorAll('br');
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('line1');
    expect(container.textContent).toContain('line2');
  });

  it('calls onStart(false) when start button is clicked without checkbox', () => {
    const onStart = vi.fn();
    render(<GuidanceModal title="T" guidance="g" onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /开始答题/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it('calls onStart(true) when checkbox is ticked and start clicked', () => {
    const onStart = vi.fn();
    render(<GuidanceModal title="T" guidance="g" onStart={onStart} />);
    fireEvent.click(screen.getByLabelText(/不再提示/));
    fireEvent.click(screen.getByRole('button', { name: /开始答题/ }));
    expect(onStart).toHaveBeenCalledWith(true);
  });

  it('does NOT call onStart when backdrop is clicked', () => {
    const onStart = vi.fn();
    const { container } = render(
      <GuidanceModal title="T" guidance="g" onStart={onStart} />
    );
    const backdrop = container.querySelector('[data-testid="guidance-backdrop"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('does NOT call onStart when Escape is pressed', () => {
    const onStart = vi.fn();
    render(<GuidanceModal title="T" guidance="g" onStart={onStart} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onStart).not.toHaveBeenCalled();
  });
});
