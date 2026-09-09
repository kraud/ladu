import { useEffect, useRef, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { VerifyEmailStatus } from '../components/VerifyEmailStatus';
import { useVerifyEmail } from '../hooks';

const route = getRouteApi('/_public/user/$userId/verify/$tokenId');

const COUNTDOWN_FROM = 3;

export function VerifyEmailPage() {
    const { userId, tokenId } = route.useParams();
    const navigate = useNavigate();
    const verify = useVerifyEmail();

    // Fire exactly once for this mount, even though `verify` is a fresh object
    // on every render (React strict-mode double-invoke included).
    const fired = useRef(false);
    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        verify.mutate({ userId, tokenId });
    }, [verify, userId, tokenId]);

    const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM);
    const enterNow = () => navigate({ to: '/' });

    useEffect(() => {
        if (!verify.isSuccess) return;
        if (secondsLeft <= 0) {
            enterNow();
            return;
        }
        const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verify.isSuccess, secondsLeft]);

    const status = verify.isSuccess ? 'success' : verify.isError ? 'error' : 'pending';

    return (
        <VerifyEmailStatus status={status} secondsLeft={secondsLeft} onEnterNow={enterNow} />
    );
}
