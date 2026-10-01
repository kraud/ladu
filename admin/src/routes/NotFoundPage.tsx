import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
    return (
        <div className="flex flex-col items-start gap-2 p-4">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <Link to="/" className="text-(--accent-strong) underline">
                Go to the overview
            </Link>
        </div>
    );
}
