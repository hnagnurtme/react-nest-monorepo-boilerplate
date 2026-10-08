import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n';
import { LANGUAGE_STORAGE_KEY } from '@/lib/i18n/languages';
import { THEME_STORAGE_KEY } from '@/shared/hooks';
import { LanguageSwitcher, ThemeProvider, ThemeToggle } from '@/shared/ui';

afterEach(async () => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  await i18n.changeLanguage('en');
});

describe('ThemeToggle', () => {
  it('switches the dark class on <html> and remembers the choice', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('starts from the stored preference rather than the OS default', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('LanguageSwitcher', () => {
  it('switches the UI language, <html lang> and the stored choice', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText('Language'), 'vi');

    await waitFor(() => {
      expect(i18n.language).toBe('vi');
    });
    expect(document.documentElement.lang).toBe('vi');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(screen.getByRole('option', { name: 'Tiếng Việt' })).toBeInTheDocument();
  });
});
