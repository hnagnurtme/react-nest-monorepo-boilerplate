import { fireEvent, render, screen } from '@testing-library/react';
import { KeyRound } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import {
  Badge,
  Button,
  CheckboxField,
  DataTable,
  DividerLabel,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  type DataTableColumn,
} from '@/shared/ui';

describe('shared UI primitives', () => {
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

describe('Button', () => {
  it('stays disabled while loading even when disabled is explicitly false', () => {
    render(
      <Button disabled={false} isLoading>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is enabled when neither disabled nor loading', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

interface Row {
  id: string;
  name: string;
}

const ROW_COLUMNS: readonly DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
];

describe('DataTable', () => {
  it('renders one row per item under the declared headers', () => {
    render(
      <DataTable
        columns={ROW_COLUMNS}
        rows={[
          { id: '1', name: 'Ada' },
          { id: '2', name: 'Grace' },
        ]}
        rowKey={(row) => row.id}
        emptyLabel="No rows"
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('spans the empty message across every column', () => {
    render(
      <DataTable columns={ROW_COLUMNS} rows={[]} rowKey={(row) => row.id} emptyLabel="No rows" />,
    );

    expect(screen.getByText('No rows')).toHaveAttribute('colspan', '1');
  });
});

describe('Pagination', () => {
  it('disables the edge a page cannot move to', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={2}
        summary="Page 1 of 2"
        previousLabel="Previous"
        nextLabel="Next"
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('Badge and PageHeader', () => {
  it('renders a badge label and a page title with its actions', () => {
    render(
      <>
        <Badge tone="success">Active</Badge>
        <PageHeader title="Users" subtitle="People" actions={<button type="button">New</button>} />
      </>,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });
});

describe('Select', () => {
  it('labels the control and reports the error to assistive tech', () => {
    render(
      <Select
        id="tenant"
        label="Tenant"
        placeholder="Pick one"
        error="Please select a tenant"
        options={[{ value: 't1', label: 'Acme' }]}
      />,
    );

    const select = screen.getByLabelText('Tenant');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'tenant-error');
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a tenant');
  });
});
