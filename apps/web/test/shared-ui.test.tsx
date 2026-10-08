import { fireEvent, render, screen } from '@testing-library/react';
import { KeyRound, Search, X } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  DataTable,
  DividerLabel,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  SkeletonTable,
  Textarea,
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
          { value: 'admin', label: 'Admin', icon: <KeyRound className="size-4" /> },
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
  { id: 'name', header: 'Name', cell: (row) => row.name },
];

describe('DataTable', () => {
  it('renders one row per item under the declared headers', () => {
    render(
      <DataTable
        caption="People"
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
      <DataTable
        caption="People"
        columns={ROW_COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        emptyLabel="No rows"
      />,
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

describe('IconButton', () => {
  it('takes its accessible name from the label, not the icon', () => {
    const onClick = vi.fn();
    render(<IconButton label="Clear the search" icon={<X />} onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Clear the search' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('LinkButton', () => {
  it('is a button, so it reports a disabled state instead of looking like a dead link', () => {
    render(
      <LinkButton disabled onClick={vi.fn()}>
        Resend
      </LinkButton>,
    );

    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();
  });
});

describe('Input adornments', () => {
  it('keeps the trailing action reachable and links the error to the field', () => {
    render(
      <Input
        id="search"
        label="Search"
        error="Too short"
        startIcon={<Search />}
        endAction={<IconButton label="Clear" icon={<X />} />}
      />,
    );

    const input = screen.getByLabelText('Search');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'search-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('omits aria-describedby when there is no error', () => {
    render(<Input id="plain" label="Name" />);

    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });
});

describe('Textarea', () => {
  it('labels the control and reports its error', () => {
    render(<Textarea id="notes" label="Notes" error="Required" />);

    expect(screen.getByLabelText('Notes')).toHaveAttribute('aria-describedby', 'notes-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});

describe('state primitives', () => {
  it('announces a problem through Alert and a failure through ErrorState', () => {
    render(
      <>
        <Alert>Could not save</Alert>
        <ErrorState title="Could not load users" />
      </>,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent('Could not save');
    expect(alerts[1]).toHaveTextContent('Could not load users');
  });

  it('does not interrupt with role=alert for a success note', () => {
    render(<Alert tone="success">Saved</Alert>);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the empty state with its one action', () => {
    render(
      <EmptyState
        title="No users found"
        description="Invite someone to get started."
        action={<Button size="sm">Invite</Button>}
      />,
    );

    expect(screen.getByText('No users found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('announces the table skeleton as busy', () => {
    render(<SkeletonTable columns={3} rows={2} label="Loading users..." />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading users...');
  });
});

describe('DataTable responsive layout', () => {
  it('stamps each cell with its column header so phones can stack the row', () => {
    render(
      <DataTable
        caption="People"
        columns={ROW_COLUMNS}
        rows={[{ id: '1', name: 'Ada' }]}
        rowKey={(row) => row.id}
        emptyLabel="No rows"
      />,
    );

    expect(screen.getByText('Ada')).toHaveAttribute('data-label', 'Name');
  });
});
