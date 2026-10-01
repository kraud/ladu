import { http, HttpResponse } from 'msw';
import { OPEN_ACCESS, type AccessStatus } from '@/features/access/types';

/** `GET /api/access` (the banners). Every page that shows a banner asks for it, so the base handler set answers "open". */
export function makeAccessHandlers(status: AccessStatus = OPEN_ACCESS) {
    return [http.get('*/api/access', () => HttpResponse.json(status))];
}
