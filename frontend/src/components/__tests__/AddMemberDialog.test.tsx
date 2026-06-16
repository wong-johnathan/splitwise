import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddMemberDialog from '../AddMemberDialog';

vi.mock('@/api/client', () => ({
  api: {
    searchUsers: vi.fn().mockResolvedValue({ users: [] }),
    addGroupMember: vi.fn().mockResolvedValue({ member: {} }),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

describe('AddMemberDialog', () => {
  const defaultProps = {
    groupId: 1,
    onClose: vi.fn(),
    onAdded: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with search input', () => {
    render(<AddMemberDialog {...defaultProps} />);
    expect(screen.getByText('Add Member')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument();
  });

  it('shows help text when no query is entered', () => {
    render(<AddMemberDialog {...defaultProps} />);
    expect(screen.getByText('Type to search users')).toBeInTheDocument();
  });
});
