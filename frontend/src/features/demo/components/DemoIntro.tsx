import { CheckIcon } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import { FlagIcon } from '@/components/common/FlagIcon';
import { TagChip } from '@/components/common/TagChip';

/**
 * Step 1 of `/demo` (`MOCKUPS/auth/demo.html`): a guided look inside the sample shelf. The kicker, the
 * title, the lead and the three feature cards. The three small pictures are decorative samples (the
 * words and tags are examples of what the demo account holds), so they are hidden from screen readers
 * and their text is not translated. The call to action is the page's job (`DemoPage`).
 */
export function DemoIntro() {
    const { t } = useTranslation();

    return (
        <div className="demo-intro">
            <p className="demo-kicker">
                <span className="demo-dot" aria-hidden="true" />
                {t('demo:start.kicker')} <span className="demo-slash" aria-hidden="true">/</span>{' '}
                {t('demo:start.kickerNote')}
            </p>

            <h1 className="demo-title">{t('demo:start.title')}</h1>
            <p className="demo-lead">
                <Trans i18nKey="demo:start.lead" components={{ strong: <strong /> }} />
            </p>

            <section className="demo-inside" aria-labelledby="demo-inside-title">
                <div className="demo-inside-head">
                    <h2 className="eyebrow" id="demo-inside-title">
                        {t('demo:start.insideTitle')}
                    </h2>
                    <span className="demo-inside-meta">{t('demo:start.insideMeta')}</span>
                </div>

                <div className="demo-feature">
                    <div className="demo-feature-copy">
                        <span className="demo-num" aria-hidden="true">01</span>
                        <div>
                            <h3>{t('demo:start.features.words.title')}</h3>
                            <p>{t('demo:start.features.words.text')}</p>
                        </div>
                    </div>
                    <div className="demo-visual demo-word-grid" aria-hidden="true">
                        {[
                            ['EN', 'tree'],
                            ['DE', 'der Baum'],
                            ['ES', 'el árbol'],
                            ['EE', 'puu'],
                        ].map(([lang, word]) => (
                            <span key={lang} className="demo-word">
                                <FlagIcon lang={lang} width={16} height={11} />
                                <b>{word}</b>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="demo-feature">
                    <div className="demo-feature-copy">
                        <span className="demo-num" aria-hidden="true">02</span>
                        <div>
                            <h3>{t('demo:start.features.tags.title')}</h3>
                            <p>{t('demo:start.features.tags.text')}</p>
                        </div>
                    </div>
                    <div className="demo-visual demo-tags" aria-hidden="true">
                        <TagChip label="Chapter 1" />
                        <TagChip label="Kitchen" />
                        <TagChip label="Exam prep" />
                        <TagChip label="Medical terms" />
                        <span className="demo-tags-more">+6</span>
                    </div>
                </div>

                <div className="demo-feature">
                    <div className="demo-feature-copy">
                        <span className="demo-num" aria-hidden="true">03</span>
                        <div>
                            <h3>{t('demo:start.features.practice.title')}</h3>
                            <p>{t('demo:start.features.practice.text')}</p>
                        </div>
                    </div>
                    <div className="demo-visual" aria-hidden="true">
                        <div className="demo-practice-top">
                            <FlagIcon lang="DE" width={16} height={11} />
                            <b>der Baum</b>
                            <span className="demo-arrow">→</span>
                            <FlagIcon lang="EN" width={16} height={11} />
                            English
                        </div>
                        <div className="demo-options">
                            <span className="demo-option">door</span>
                            <span className="demo-option ok">
                                tree <CheckIcon size={10} weight="bold" />
                            </span>
                            <span className="demo-option">bread</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
