import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Temporary primitives gallery — Slice 1 "runnable" deliverable.
 * Lets the design-system port be eyeballed against MOCKUPS/index.html's
 * component section side by side. Removed in Slice 4 once the router
 * and real pages take over rendering.
 */
export function App() {
    return (
        <main className="container mx-auto max-w-3xl page space-y-8 px-6 py-10">
            <h1 className="h1">Ladu — primitives gallery</h1>

            <section className="stack gap-3">
                <h2 className="eyebrow">Buttons</h2>
                <div className="flex flex-wrap items-center gap-3">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Danger</Button>
                    <Button disabled>Disabled</Button>
                    <Button>
                        <span className="spinner" />
                        Signing in…
                    </Button>
                </div>
            </section>

            <section className="stack gap-3">
                <h2 className="eyebrow">Fields</h2>
                <div className="grid max-w-sm gap-4">
                    <div className="field">
                        <Label className="label" htmlFor="gallery-email">
                            Email
                        </Label>
                        <Input id="gallery-email" type="email" placeholder="you@example.com" />
                    </div>
                    <div className="field">
                        <Label className="label" htmlFor="gallery-invalid">
                            Password
                        </Label>
                        <Input id="gallery-invalid" type="password" aria-invalid="true" defaultValue="short" />
                        <span className="err show">Password is required</span>
                    </div>
                </div>
            </section>

            <section className="stack gap-3">
                <h2 className="eyebrow">Cards &amp; states</h2>
                <div className="grid max-w-sm gap-4">
                    <div className="card card-pad stack gap-2">
                        <h3 className="h3">Card title</h3>
                        <p className="text-sm text-muted-foreground">Body copy inside a `.card .card-pad` shell.</p>
                    </div>
                    <div className="banner warning">
                        <span>Verify your email to unlock every feature.</span>
                    </div>
                    <Skeleton className="h-9 w-full" />
                </div>
            </section>
        </main>
    );
}
