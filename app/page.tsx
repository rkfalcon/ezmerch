import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { bannerColor, bannerTextColor } from "@/lib/store-banner";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch stores that have at least one published product (single query)
  const { data: storesWithProducts } = await supabase
    .from("stores")
    .select("id, name, slug, brand_colors, logo_url, banner_color, banner_text_color, header_color, header_text_color, products!inner(id)")
    .eq("selling_enabled", true)
    .eq("products.published", true)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            EZMerch
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Custom Merch,
            <br />
            <span className="text-muted-foreground">Zero Hassle</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            EZMerch makes it easy to sell custom branded merchandise from your
            own storefront. We handle printing, shipping, and payments — you
            just focus on your brand.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Store Directory */}
      {storesWithProducts && storesWithProducts.length > 0 && (
        <section className="border-t py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">
              Browse Stores
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {storesWithProducts.map((store) => (
                <Link key={store.id} href={`/${store.slug}`}>
                  <Card
                    className="overflow-hidden transition-shadow hover:shadow-md h-full pt-0"
                    style={{
                      backgroundColor: bannerColor(store.banner_color, store.brand_colors.primary),
                      color: store.banner_text_color ?? bannerTextColor(bannerColor(store.banner_color, store.brand_colors.primary)),
                    }}
                  >
                    <div
                      className="h-24 flex items-center justify-center"
                      style={{
                        backgroundColor: bannerColor(store.banner_color, store.brand_colors.primary),
                      }}
                    >
                      {store.logo_url ? (
                        <img
                          src={store.logo_url}
                          alt={store.name}
                          className="h-12 w-12 object-contain"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white"
                          style={{
                            backgroundColor: store.brand_colors.primary,
                          }}
                        >
                          {store.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <CardContent className="pt-4">
                      <h3 className="font-medium text-center">
                        {store.name}
                      </h3>
                    </CardContent>
                    <CardFooter
                      className="justify-center"
                      style={{
                        backgroundColor: store.header_color ?? "#ffffff",
                        color: store.header_text_color ?? "#000000",
                      }}
                    >
                      <span className="text-xs font-mono">
                        ezmerch.store/{store.slug}
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EZMerch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
