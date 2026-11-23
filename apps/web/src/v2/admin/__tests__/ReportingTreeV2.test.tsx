import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportingTreeV2 } from '../ReportingTreeV2';
import { fetchApi, patchApi } from '../../../api/client';

let mockPermissions: string[] = ['USERS_VIEW'];

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@sgh.com',
      roles: [{ id: 'r1', name: 'Administrator', code: 'ADMINISTRATOR' }],
      permissions: mockPermissions,
    },
  }),
}));

vi.mock('../../../api/client', () => ({
  fetchApi: vi.fn(),
  getApi: vi.fn(),
  postApi: vi.fn(),
  patchApi: vi.fn(),
}));

const mockUsers = [
  {
    id: 'lead-1',
    email: 'lead@sgh.com',
    displayName: 'Mona TeamLeader',
    jobTitle: 'Recruitment Team Leader',
    status: 'Active',
    managerId: null,
    roles: [{ id: 'r2', name: 'Recruitment Team Leader', code: 'TEAM_LEADER' }],
    lastLoginAt: null,
    branchName: 'SGH Dubai Hospital',
  },
  {
    id: 'rec-1',
    email: 'sarah@sgh.com',
    displayName: 'Sarah Ahmed',
    jobTitle: 'Recruiter',
    status: 'Active',
    managerId: 'lead-1',
    roles: [{ id: 'r3', name: 'Recruiter', code: 'RECRUITER' }],
    lastLoginAt: null,
    branchName: 'SGH Dubai Hospital',
  },
  {
    id: 'rec-2',
    email: 'ahmed@sgh.com',
    displayName: 'Ahmed Mostafa',
    jobTitle: 'Recruiter',
    status: 'Active',
    managerId: 'lead-1',
    roles: [{ id: 'r3', name: 'Recruiter', code: 'RECRUITER' }],
    lastLoginAt: null,
    branchName: 'SGH Dubai Hospital',
  },
];

describe('ReportingTreeV2 (Visual Org Chart & Hierarchy Management)', () => {
  const mockFetchApi = vi.mocked(fetchApi);
  const mockPatchApi = vi.mocked(patchApi);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = ['USERS_VIEW'];
    mockFetchApi.mockResolvedValue(mockUsers);
    mockPatchApi.mockResolvedValue({ ...mockUsers[1], managerId: null });
  });

  it('renders the visual hierarchy with managers above their reports and auto-drawn SVG edges', async () => {
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sarah Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Mostafa')).toBeInTheDocument();

    // Manager card plus one "Reports to" line per direct report.
    expect(screen.getAllByText('Mona TeamLeader')).toHaveLength(3);
    // Reporting count pill
    expect(screen.getByText((_, el) => el?.textContent?.trim() === '2 reporting')).toBeInTheDocument();
    // Auto-drawn connectors overlay rendered
    expect(screen.getByTestId('reporting-tree-edges')).toBeInTheDocument();
    // Org chart canvas rendered
    expect(screen.getByTestId('reporting-org-canvas')).toBeInTheDocument();
  });

  it('lets administrators re-link who reports to whom with cycle prevention', async () => {
    mockPermissions = ['USERS_VIEW', 'USERS_MANAGE'];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    const managerSelect = await screen.findByLabelText('Select manager for Sarah Ahmed');
    expect(managerSelect).toBeInTheDocument();
    await user.selectOptions(managerSelect, '');
    await waitFor(() => {
      expect(mockPatchApi).toHaveBeenCalledWith('/users/rec-1', { managerId: null });
    });
  });

  it('is view-only for users without USERS_MANAGE permission', async () => {
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    expect(screen.queryByLabelText('Select manager for Sarah Ahmed')).toBeNull();
    expect(screen.getByText(/view only/i)).toBeInTheDocument();
  });

  it('supports switching between Org Chart and Hierarchy Outline modes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    const outlineTab = screen.getByRole('tab', { name: /Hierarchy Outline/i });
    await user.click(outlineTab);

    expect(screen.getByLabelText('Reporting hierarchy tree')).toBeInTheDocument();
    expect(screen.getByText('Organization Hierarchy Outline')).toBeInTheDocument();
  });

  it('supports focusing on a manager subtree', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    const subtreeSelect = screen.getByLabelText('Focus manager subtree');
    await user.selectOptions(subtreeSelect, 'lead-1');

    expect(screen.getByText(/Filtering subtree for/i)).toBeInTheDocument();
  });

  it('defaults to 60% zoom, allows zooming out to 40%, and provides quick presets and reset', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');

    // Default zoom is 60%
    const zoomLabel = screen.getByTestId('reporting-zoom-label');
    expect(zoomLabel).toHaveTextContent('60%');

    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom out' });
    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    expect(zoomInBtn).toBeEnabled();

    // Zoom out 60% -> 50%
    await user.click(zoomOutBtn);
    expect(zoomLabel).toHaveTextContent('50%');

    // Zoom out 50% -> 40% (minimum allowed)
    await user.click(zoomOutBtn);
    expect(zoomLabel).toHaveTextContent('40%');
    expect(zoomOutBtn).toBeDisabled();

    // Reset button appears and restores default 60%
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    await user.click(resetBtn);
    expect(zoomLabel).toHaveTextContent('60%');

    // Preset 100% button
    const preset100Btn = screen.getByRole('button', { name: '100%' });
    await user.click(preset100Btn);
    expect(zoomLabel).toHaveTextContent('100%');

    // Preset 40% button
    const preset40Btn = screen.getByRole('button', { name: '40%' });
    await user.click(preset40Btn);
    expect(zoomLabel).toHaveTextContent('40%');
    expect(zoomOutBtn).toBeDisabled();
  });

  it('honors hideHeader prop to avoid duplicate header when embedded in Users directory', async () => {
    render(
      <MemoryRouter>
        <ReportingTreeV2 hideHeader />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    expect(screen.queryByRole('heading', { level: 1, name: 'Reporting Tree' })).toBeNull();
    // Org chart controls still rendered cleanly
    expect(screen.getByRole('tab', { name: /Org Chart/i })).toBeInTheDocument();
  });

  it('supports catching and panning the canvas like Figma with keyboard and mouse interactions', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    const viewport = screen.getByRole('region', { name: /Interactive organization chart canvas/i });
    expect(viewport).toBeInTheDocument();

    // The canvas scaler is initially centered at (0, 0)
    const scaler = viewport.querySelector('.rf2-org-canvas-scaler') as HTMLElement;
    expect(scaler).toHaveStyle('transform: translate3d(0px, 0px, 0) scale(0.6)');

    // Arrow keys pan the canvas when focused
    viewport.focus();
    await user.keyboard('{ArrowRight}');
    expect(scaler).toHaveStyle('transform: translate3d(-40px, 0px, 0) scale(0.6)');

    // Center button appears in HUD and recenters the canvas
    const centerBtn = screen.getByRole('button', { name: 'Center canvas position' });
    expect(centerBtn).toBeInTheDocument();
    await user.click(centerBtn);
    expect(scaler).toHaveStyle('transform: translate3d(0px, 0px, 0) scale(0.6)');
  });

  it('keeps SVG connector paths scale-invariant in layout coordinates when changing zoom presets mid-transition', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReportingTreeV2 />
      </MemoryRouter>,
    );

    await screen.findByText('Sarah Ahmed');
    const canvas = screen.getByTestId('reporting-org-canvas');
    const monaCard = screen.getByTitle('Mona TeamLeader').closest('.rf2-org-card-wrapper') as HTMLElement;
    const ahmedCard = screen.getByTitle('Ahmed Mostafa').closest('.rf2-org-card-wrapper') as HTMLElement;
    const sarahCard = screen.getByTitle('Sarah Ahmed').closest('.rf2-org-card-wrapper') as HTMLElement;

    Object.defineProperty(canvas, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(canvas, 'scrollHeight', { configurable: true, value: 600 });

    const defineBox = (el: HTMLElement, left: number, top: number, width: number, height: number) => {
      Object.defineProperty(el, 'offsetParent', { configurable: true, value: canvas });
      Object.defineProperty(el, 'offsetLeft', { configurable: true, value: left });
      Object.defineProperty(el, 'offsetTop', { configurable: true, value: top });
      Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
      // Simulate stale pre-transition 0.6x rects even when zoom switches to 100% or 40%.
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: left * 0.6,
        top: top * 0.6,
        right: (left + width) * 0.6,
        bottom: (top + height) * 0.6,
        width: width * 0.6,
        height: height * 0.6,
        x: left * 0.6,
        y: top * 0.6,
        toJSON: () => ({}),
      });
    };

    defineBox(monaCard, 300, 20, 260, 120);
    defineBox(ahmedCard, 120, 220, 260, 120);
    defineBox(sarahCard, 480, 220, 260, 120);

    await user.click(screen.getByRole('button', { name: '100%' }));
    const svg = screen.getByTestId('reporting-tree-edges');
    const pathsAt100 = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(pathsAt100).toEqual([
      'M 430 140 C 430 180, 250 180, 250 220',
      'M 430 140 C 430 180, 610 180, 610 220',
    ]);

    await user.click(screen.getByRole('button', { name: '40%' }));
    const pathsAt40 = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
    expect(pathsAt40).toEqual(pathsAt100);
  });
});
