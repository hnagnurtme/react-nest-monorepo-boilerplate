import { fireEvent, render, screen } from '@testing-library/react';
import { KeyRound } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { GoogleIcon } from '@/shared/icons';
import { CheckboxField, DividerLabel, SegmentedControl } from '@/shared/ui';

describe('shared UI primitives', () => {
  it('renders brand icons from shared icons', () => {
    render(<GoogleIcon title="Google" />);

    expect(screen.getByTitle('Google')).toBeInTheDocument();
  });

  it('renders a labeled divider', () => {
    render(<DividerLabel label="or continue with" />);

    expect(screen.getByText('or continue with')).toBeInTheDocument();
  });

  it('changes selected segment when a different option is clicked', () => {
    const handleChange = vi.fn();

    render(
      <SegmentedControl
        value="member"
        onValueChange={handleChange}
        options={[
          { value: 'member', label: 'Member' },
          { value: 'admin', label: 'Admin', icon: <KeyRound className="h-4 w-4" /> },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));

    expect(handleChange).toHaveBeenCalledWith('admin');
  });

  it('connects checkbox labels to their inputs', () => {
    render(<CheckboxField id="remember" label="Remember me" />);

    expect(screen.getByLabelText('Remember me')).toHaveAttribute('type', 'checkbox');
  });
});
