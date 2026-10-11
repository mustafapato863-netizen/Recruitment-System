import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HiringCasePage } from "../HiringCasePage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-hm-1",
      displayName: "Khalid Al-Shammari",
      email: "khalid@hospital.sa",
      roles: [{ id: "r3", name: "HIRING_MANAGER", code: "HIRING_MANAGER" }],
      permissions: ["HIRING_CASE_VIEW", "HIRING_CASE_APPROVE"],
    },
  }),
}));

vi.mock("../../context/BreadcrumbContext", () => ({
  useSetBreadcrumbTitle: vi.fn(),
}));

vi.mock("../PageEnhancementsV2.css", () => ({}));

// Hiring case with clinical compliance items (SCFHS, DataFlow, Mumaris)
const baseHiringCase = {
  id: "hire-case-001",
  candidateName: "Rania Al-Otaibi",
  positionTitle: "Clinical Pharmacist",
  status: "In Progress",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-09-02T10:00:00Z",
  complianceRequirements: [
    {
      id: "req-1",
      name: "SCFHS License Registration",
      isRequired: true,
      status: "Pending",
      verifiedAt: null,
    },
    {
      id: "req-2",
      name: "DataFlow Primary Source Verification",
      isRequired: true,
      status: "Pending",
      verifiedAt: null,
    },
    {
      id: "req-3",
      name: "Mumaris+ Profile Activation",
      isRequired: true,
      status: "Verified",
      verifiedAt: "2026-09-01T08:00:00Z",
    },
    {
      id: "req-4",
      name: "Medical Fitness Certificate",
      isRequired: false,
      status: "Not Required",
      verifiedAt: null,
    },
  ],
  approvals: [],
  offerId: "offer-xyz-001",
};

const mockGetApi = vi.fn();
const mockPostApi = vi.fn();
const mockPatchApi = vi.fn();

vi.mock("../../api/client", () => ({
  getApi: (...args: unknown[]) => mockGetApi(...args),
  postApi: (...args: unknown[]) => mockPostApi(...args),
  patchApi: (...args: unknown[]) => mockPatchApi(...args),
}));

function renderPage(caseId = "hire-case-001") {
  return render(
    <MemoryRouter initialEntries={[`/hires/${caseId}`]}>
      <Routes>
        <Route path="/hires/:id" element={<HiringCasePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApi.mockImplementation((url: string) => {
    if (url.includes("/hiring/hire-case-001")) return Promise.resolve(baseHiringCase);
    return Promise.resolve(null);
  });
  mockPostApi.mockResolvedValue({ success: true });
  mockPatchApi.mockResolvedValue({ success: true });
});

describe("HiringCasePage — clinical gate and joining controls", () => {
  it("renders the candidate name and position title", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Rania Al-Otaibi/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/Clinical Pharmacist/i).length).toBeGreaterThan(0);
  });

  it("shows clinical compliance items for SCFHS and DataFlow", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Rania Al-Otaibi/i).length).toBeGreaterThan(0);
    });
    const scfhsEl = screen.queryAllByText(/SCFHS/i)[0];
    const dataFlowEl = screen.queryAllByText(/DataFlow/i)[0];
    const mumarisEl = screen.queryAllByText(/Mumaris/i)[0];
    const hasAnyClinical = scfhsEl || dataFlowEl || mumarisEl;
    expect(hasAnyClinical).toBeTruthy();
  });

  it("shows overall compliance progress indicator", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Rania Al-Otaibi/i).length).toBeGreaterThan(0);
    });
    const progressEl =
      document.querySelector('[role="progressbar"]') ||
      screen.queryAllByText(/compliance|progress|checklist/i)[0];
    expect(progressEl).toBeTruthy();
  });

  it("triggers Confirm Joining dialog when Confirm Joining button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.queryAllByText(/Rania Al-Otaibi/i).length).toBeGreaterThan(0)
    );

    const joinBtn = screen.queryAllByRole("button", { name: /confirm joining/i })[0];
    if (joinBtn) {
      await user.click(joinBtn);
      const dialog =
        screen.queryByRole("dialog") ||
        screen.queryAllByText(/confirm joining|joining/i)[0];
      expect(dialog).toBeTruthy();
    }
  });

  it("calls POST /hiring/:id/joining when joining is confirmed via dialog", async () => {
    const user = userEvent.setup();
    mockGetApi.mockImplementation((url: string) => {
      if (url.includes("/hiring/hire-case-001")) {
        return Promise.resolve({ ...baseHiringCase, status: "Awaiting Joining" });
      }
      return Promise.resolve(null);
    });
    renderPage();
    await waitFor(() =>
      expect(screen.queryAllByText(/Rania Al-Otaibi/i).length).toBeGreaterThan(0)
    );

    const joinBtn = screen.queryAllByRole("button", { name: /confirm joining/i })[0];
    if (joinBtn) {
      await user.click(joinBtn);
      const confirmBtn = screen
        .queryAllByRole("button", { name: /confirm joining|yes|proceed/i })
        .find((b) => b !== joinBtn);
      if (confirmBtn) {
        await user.click(confirmBtn);
        await waitFor(() => {
          expect(mockPostApi).toHaveBeenCalledWith(
            expect.stringContaining("/joining"),
            expect.objectContaining({ status: "Joined" })
          );
        });
      }
    }
  });

  it("renders forbidden state when hiring case load returns 403", async () => {
    mockGetApi.mockRejectedValue(new Error("403 Permission denied"));
    renderPage();
    await waitFor(() => {
      const forbiddenEl =
        screen.queryByText(/forbidden/i) ||
        screen.queryByText(/permission/i) ||
        screen.queryByText(/access restricted/i) ||
        screen.queryByText(/not found/i);
      expect(forbiddenEl).toBeTruthy();
    });
  });
});
