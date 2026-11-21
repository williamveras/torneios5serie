import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SponsorBanner } from "./PublicSponsors";
import { sponsorWebsite, type Sponsor } from "@/lib/sponsors";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
afterEach(cleanup);
const sponsor: Sponsor = { id: "s", tournament_id: "t", name: "Cegos Brasil", category: "sponsor", website: null, enabled: true, position: 1 };
it("displays a sponsor without requiring a website", () => {
  render(<SponsorBanner sponsors={[sponsor]} />);
  expect(screen.getByText("Patrocínio: Cegos Brasil")).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("does not render hidden sponsors or an empty banner", () => {
  const { container } = render(<SponsorBanner sponsors={[{ ...sponsor, enabled: false }]} />);
  expect(container).toBeEmptyDOMElement();
});
it("renders safe sponsor links and preserves support labels", () => {
  render(<SponsorBanner sponsors={[{ ...sponsor, category: "support", website: "https://example.com" }]} />);
  expect(screen.getByRole("link", { name: "Cegos Brasil" })).toHaveAttribute("rel", "noopener noreferrer sponsored");
  expect(screen.getByText(/Apoio:/)).toBeVisible();
});
it.each(["javascript:alert(1)", "data:text/html,test", "https://user:password@example.com"])("rejects unsafe links %s", value => {
  expect(() => sponsorWebsite(value)).toThrow();
  render(<SponsorBanner sponsors={[{ ...sponsor, website: value }]} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText(/Cegos Brasil/)).toBeVisible();
});
