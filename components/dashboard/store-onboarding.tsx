"use client";
import { productTitle } from "@/lib/product-title";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PrintQualityReport } from "@/lib/lineup/print-quality";
import { LineupLogo } from "./lineup-logo";
import { LogoFileInput } from "./logo-file-input";
import { Input } from "@/components/ui/input";
interface Setup {
  store: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    selling_enabled: boolean;
  } | null;
  products: {
    id: string;
    title: string;
    image: string | null;
    ready: boolean;
    jobId?: string;
    quality?: PrintQualityReport;
    status: string;
    completed: number;
    total: number;
  }[];
}
export function StoreOnboarding() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stripe, setStripe] = useState<{
    ready: boolean;
    started: boolean;
    submitted?: boolean;
  } | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setSetup(data);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      load().catch((e) => {
        if (active) setError(e.message);
      });
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);
  const checkStripe = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const r = await fetch("/api/onboarding/stripe-status", {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setStripe(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check payouts.");
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (setup?.store?.id) void checkStripe();
  }, [setup?.store?.id, setup?.store?.selling_enabled, checkStripe]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: setup?.store?.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setBusy(false);
    }
  }
  async function launch() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/onboarding/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptEarningsPolicy: acceptedPolicy }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const store = setup?.store;
  const hasLogo = !!store?.logo_url;
  const ready = setup?.products.filter((p) => p.ready).length ?? 0;
  const previews = setup?.products.filter((p) => p.image).length ?? 0;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Your store, in three simple steps
        </p>
        <h1 className="text-3xl font-bold">
          {store?.selling_enabled
            ? `${store.name} is open!`
            : "Let’s get your store ready"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add your logo. We’ll put it on your products. Connect payouts when
          you’re ready to get paid.
        </p>
      </div>
      <ol className="grid grid-cols-3 gap-2 text-sm" aria-label="Setup steps">
        {["1. Your store", "2. Your products", "3. Start selling"].map(
          (label, i) => (
            <li
              key={label}
              className={`rounded-lg border p-3 ${(!hasLogo ? i === 0 : store?.selling_enabled ? i === 2 : i === 1) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {label}
            </li>
          ),
        )}
      </ol>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 p-3 text-sm"
        >
          {error}{" "}
          {!setup && (
            <Button
              variant="outline"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {!setup && !error && <p role="status">Loading your setup…</p>}
      {setup && !hasLogo && (
        <form
          onSubmit={create}
          className="max-w-xl space-y-5 rounded-xl border p-6"
        >
          <h2 className="text-xl font-semibold">Tell us about your store</h2>
          <label className="block space-y-2">
            Store name
            <Input
              name="name"
              required
              maxLength={100}
              defaultValue={store?.name ?? ""}
              placeholder="For example, Mostly Smoked"
              disabled={busy}
            />
          </label>
          <label className="block space-y-2">
            Website{" "}
            <span className="text-sm text-muted-foreground">(optional)</span>
            <Input
              name="website"
              placeholder="yourbusiness.com"
              maxLength={2000}
              disabled={busy}
            />
          </label>
          <LogoFileInput disabled={busy} onReady={setLogoReady} />
          <Button type="submit" disabled={busy || !logoReady}>
            {busy ? "Creating your store…" : "Create my store"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No bank details needed yet. You can review everything before
            selling.
          </p>
        </form>
      )}
      {store && hasLogo && (
        <>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              Change your logo & regenerate products
            </summary>
            <div className="mt-4">
              <LineupLogo storeId={store.id} logoUrl={store.logo_url} />
            </div>
          </details>
          <section className="rounded-xl border p-5 space-y-3">
            <h2 className="text-xl font-semibold">
              {store.selling_enabled
                ? "Share your store"
                : ready === setup!.products.length
                  ? "Your products are ready"
                  : "Your branded products are on their way"}
            </h2>
            <p role="status">
              {previews} of {setup!.products.length} product previews ready.{" "}
              {ready} products available.{" "}
              {ready < setup!.products.length &&
                "We create one preview color per product first, then prepare the remaining colors. You can leave this page—we’ll keep working and notify you on your dashboard and by email when the full lineup is ready."}
            </p>
            {!setup!.products.length && (
              <p>The product lineup is being prepared. Your logo is saved.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Link
                className="underline"
                href={`/${store.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                {store.selling_enabled
                  ? "Open your store"
                  : "Preview your storefront"}{" "}
                ↗
              </Link>
              <Link className="underline" href="/dashboard/store/products">
                Manage products and prices
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {store.selling_enabled
                ? `verymerch.com/${store.slug}`
                : "Choose Start selling to open checkout. You can finish payout setup afterward."}
            </p>
          </section>
          {(!store.selling_enabled || !stripe?.ready) && (
            <section className="rounded-xl border p-5 space-y-3">
              <h2 className="text-xl font-semibold">Get ready to be paid</h2>
              <p>
                Stripe securely collects your business and bank details so you
                can receive payouts. You can do this while your products are
                being prepared.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={connect}>
                  {busy
                    ? "Please wait…"
                    : stripe?.started
                      ? "Continue Stripe setup"
                      : "Set up payouts"}
                </Button>
                <Button
                  variant="outline"
                  disabled={checking || busy}
                  onClick={checkStripe}
                >
                  {checking ? "Checking…" : "I’ve completed Stripe setup"}
                </Button>
              </div>
              {stripe && (
                <p role="status">
                  {stripe.ready
                    ? "Payouts are ready. You can open your store when your first product is ready."
                    : stripe.submitted
                      ? "Stripe is reviewing your details. Check again shortly, or continue setup if more information is needed."
                      : "Finish the Stripe form, then return here to check your status."}
                </p>
              )}
              <p className="text-sm">
                You earn 70% of merchandise margin after product and printing
                costs. Complete Stripe verification within 30 days of each sale
                to collect that sale’s share. After its deadline, VeryMerch
                retains 100% of that sale’s margin. Once verified, future sales
                qualify automatically. Shipping and tax are excluded.
              </p>
              {!store.selling_enabled && (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={acceptedPolicy}
                      onChange={(e) => setAcceptedPolicy(e.target.checked)}
                      className="mt-1"
                    />
                    I agree to the 70/30 split and the 30-day Stripe setup
                    deadline for each sale.
                  </label>
                  <Button
                    disabled={busy || !ready || !acceptedPolicy}
                    onClick={launch}
                  >
                    Start selling
                  </Button>
                </>
              )}
              <Link
                className="block underline"
                href="/dashboard/store/earnings"
              >
                View earnings and deadlines
              </Link>
              <p className="text-xs text-muted-foreground">
                Available products will be offered for sale. Any still
                generating will appear when ready. You can hide products or
                colors from Products.
              </p>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Made for {store.name}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {setup!.products.map((p) => (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-xl border p-3"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={`${productTitle(p.title)} with your logo`}
                      className="aspect-square w-full bg-white object-contain"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-muted p-4 text-center text-sm">
                      {p.status === "unavailable" ? "Temporarily unavailable" : p.quality &&
                      !p.quality.reviewedAt &&
                      p.quality.status !== "ready"
                        ? "VeryMerch is preparing this artwork"
                        : p.status === "failed"
                          ? "VeryMerch is preparing this product"
                          : "Preparing your logo mockup…"}
                    </div>
                  )}
                  <h3 className="mt-3 text-sm font-medium">{productTitle(p.title)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.status === "unavailable" ? "Hidden from your storefront. We’ll check availability automatically." : p.ready
                      ? p.completed < p.total
                        ? "Ready · more colors are being prepared"
                        : "Ready"
                      : p.quality &&
                          p.quality.status !== "ready" &&
                          !p.quality.reviewedAt
                        ? "VeryMerch is checking this design. No action is needed from you."
                        : p.status === "failed"
                          ? "The VeryMerch team will handle this product. No action is needed from you."
                          : p.total
                            ? `${p.completed} of ${p.total} image groups ready`
                            : "Queued for generation"}
                  </p>
                </article>
              ))}
            </div>
          </section>
          {!!previews && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Your storefront</h2>
              <iframe
                key={`${previews}-${ready}`}
                title="Your storefront preview"
                src={`/${store.slug}`}
                className="h-[550px] w-full rounded-xl border"
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
