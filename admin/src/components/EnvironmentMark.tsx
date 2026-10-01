import { Factory, MicrophoneStage } from '@phosphor-icons/react';
import { environmentMark } from '@/lib/environment';

/**
 * The environment mark next to the header title: a stage microphone for staging
 * and a factory for production, and nothing for a dev or unknown environment. The
 * glyphs are the "regular" weight of `@phosphor-icons/react` (the mark is real,
 * not invented artwork). The tooltip and the accessible name say which it is, for
 * anyone who does not recognise the glyph.
 */
export function EnvironmentMark({ environment }: { environment: string }) {
    const mark = environmentMark(environment);
    if (mark === null) return null;

    const label = mark === 'staging' ? 'Staging' : 'Production';
    return (
        <span className="inline-flex shrink-0" role="img" aria-label={label} title={label}>
            {mark === 'staging' ? <MicrophoneStage className="size-4" /> : <Factory className="size-4" />}
        </span>
    );
}
