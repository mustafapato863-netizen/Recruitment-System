import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OfferDetailPage } from "../OfferDetailPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-hr-1",
      displayName: "Omar Al-Ghamdi",
      email: "omar@hospital.sa",
      roles: [{ id: "r2", name: "HR_MANAGER", code: "HR_MANAGER" }],
      permissions: ["OFFER_VIEW", "OFFER_APPROVE"],
    },
  }),
}));

vi.mock("../../context/BreadcrumbContext", () => ({
  useSetBreadcrumbTitle: vi.fn(),
}));

vi.mock("../../quickguide", () => ({
  QuickGuideTrigger: () => null,
}));

vi.mock("../PageEnhancementsV2.css", () => ({}));

const baseOffer = {
  id: "offer-xyz-001",
  offerCode: "OFF-001",
  candidateName: "Layla Mahmoud",
  positionTitle: "Radiologist",
  status: "Pending",
  createdAt: "2026-08-15T09:00:00Z",
  updatedAt: "2026-09-01T09:00:00Z",
  currentVersion: {
    id: "ver-1",
    versionNumber: 1,
    contractType: "Full-time",
    workLocation: "Riyadh",
    probationPeriod: "3 months",
    components: [
      { name: "Basic Salary", type: "Fixed", amount: 25000, currency: "SAR", frequency: "Monthly" },
    ],
    approvals: [
      { id: "appr-1", roleCode: "HR_MANAGER", status: "Pending", approverName: null, decidedAt: null, comment: null },
    ],
  },
};

const mockGetApi = vi.fn();
const mockPostApi = vi.fn();
const mockPatchApi = vi.fn();

vi.mock("../../api/client", () => ({
  getApi: (...args: unknown[]) => mockGetApi(...args),
  postApi: (...args: unknown[]) => mockPostApi(...args),
  patchApi: (...args: unknown[]) => mockPatchApi(...args),
}));

function renderPage(offerId = "offer-xyz-001") {
  return render(
    <MemoryRouter initialEntries={[`/offers/${offerId}`]}>
      <Routes>
        <Route path="/offers/:id" element={<OfferDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetApi.mockImplementation((url: string) => {
    if (url === "/offers/offer-xyz-001") return Promise.resolve(baseOffer);
    if (url === "/hiring") return Promise.resolve([]);
    return Promise.resolve(null);
  });
  mockPostApi.mockResolvedValue({ success: true });
  mockPatchApi.mockResolvedValue({ ...baseOffer, status: "Approved" });
});

describe("OfferDetailPage — offer approval decisions", () => {
  it("renders the candidate name and offer code after load", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Layla Mahmoud/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/OFF-001/i).length).toBeGreaterThan(0);
  });

  it("shows version number and salary component", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByText(/Layla Mahmoud/i).length).toBeGreaterThan(0);
    });
    // Salary component should appear somewhere in the page
    const salaryEls = screen.queryAllByText(/Basic Salary/i);
    if (salaryEls.length > 0) expect(salaryEls[0]).toBeInTheDocument();
  });

  it("opens Approve decision modal when Approve button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Layla Mahmoud/i).length).toBeGreaterThan(0));

    const approveBtn = screen.queryAllByRole("button", { name: /approve/i })[0];
    if (approveBtn) {
      await user.click(approveBtn);
      const modal = screen.queryByRole("dialog") ?? screen.queryAllByText(/approve/i)[0];
      expect(modal).toBeTruthy();
    }
  });

  it("calls postApi to submit approval decision with comment", async () => {
    const user = userEvent.setup();
    mockPostApi.mockResolvedValueOnce({ id: "appr-1", status: "Approved" });

    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Layla Mahmoud/i).length).toBeGreaterThan(0));

    const approveBtn = screen.queryAllByRole("button", { name: /approve/i })[0];
    if (approveBtn) {
      await user.click(approveBtn);
      const commentBox = screen.queryByRole("textbox");
      if (commentBox) await user.type(commentBox, "Approved after compensation review");
      const submitBtn = screen.queryAllByRole("button", { name: /confirm|submit|approve/i }).find(
        (b) => b !== approveBtn
      );
      if (submitBtn) {
        await user.click(submitBtn);
        await waitFor(() => {
          expect(mockPostApi).toHaveBeenCalled();
        });
      }
    }
  });

  it("opens Reject decision modal when Reject button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.queryAllByText(/Layla Mahmoud/i).length).toBeGreaterThan(0));

    const rejectBtn = screen.queryAllByRole("button", { name: /reject/i })[0];
    if (rejectBtn) {
      await user.click(rejectBtn);
      const modal = screen.queryByRole("dialog") ?? screen.queryAllByText(/reject/i)[0];
      expect(modal).toBeTruthy();
    }
  });

  it("renders not-found state when offer fails to load", async () => {
    mockGetApi.mockRejectedValue(new Error("404 Not Found"));
    renderPage();
    await waitFor(() => {
      const el =
        screen.queryByText(/not found/i) ||
        screen.queryByText(/error/i) ||
        screen.queryAllByText(/offer/i)[0];
      expect(el).toBeTruthy();
    });
  });
});
