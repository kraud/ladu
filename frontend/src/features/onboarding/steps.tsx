import { BookOpenTextIcon, ChartBarIcon, ChatTeardropTextIcon, TranslateIcon, type Icon } from '@phosphor-icons/react';

/** The four questions, in order (the welcome and the building screen are not steps). */
export const STEP_META: { id: 'languages' | 'levels' | 'topics' | 'count'; icon: Icon }[] = [
    { id: 'languages', icon: TranslateIcon },
    { id: 'levels', icon: ChartBarIcon },
    { id: 'topics', icon: ChatTeardropTextIcon },
    { id: 'count', icon: BookOpenTextIcon },
];
