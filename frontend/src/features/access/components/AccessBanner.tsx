import { useTranslation } from 'react-i18next';
import type { GateStatus } from '../types';

/**
 * A banner for one gate. Nothing for `open`. The translated message depends on the state;
 * the owner's extra line is shown under it as TEXT (React escapes it): no markup, no links.
 * The extra line is not translated.
 */
export function AccessBanner({ gate, status }: { gate: 'registration'; status: GateStatus }) {
    const { t } = useTranslation();
    if (status.mode === 'open') return null;

    const message =
        status.mode === 'closed' ? t(`loginRegister:access.${gate}Closed`) : t(`loginRegister:access.${gate}Limited`);

    return (
        <div className={`banner ${status.mode === 'closed' ? 'warning' : 'info'} items-start`} role="status">
            <div>
                <p>{message}</p>
                {status.note && <p className="mt-1 whitespace-pre-line font-semibold">{status.note}</p>}
            </div>
        </div>
    );
}
