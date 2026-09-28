/**
 * Backend error -> i18n key, mirroring `features/words/errors.ts`. Every
 * message below is a verbatim `throw new Error(...)` from `tagController.ts`
 * (`listTags` / `getTagById` / `createTag` / `updateTag` / `deleteTag` /
 * `followTag` / `unfollowTag` / `cloneTag` / `linkTagsToWords` /
 * `unlinkTagsFromWords` — the endpoints this feature's `api.ts` actually
 * calls; tag-*sharing*'s own messages are Phase 7's concern).
 */
import { getApiErrorMessage } from '@/api/types';

export const GENERIC_ERROR_KEY = 'common:errors.somethingWrong';

const MESSAGE_TO_KEY: Record<string, string> = {
    'Tag not found': 'tags:apiErrors.tagNotFound',
    'User not authorized': 'tags:apiErrors.notAuthorized',
    'User not authorized to delete this tag': 'tags:apiErrors.notAuthorizedToDelete',
    'User not authorized to follow this tag': 'tags:apiErrors.notAuthorizedToFollow',
    'User not authorized to clone this tag': 'tags:apiErrors.notAuthorizedToClone',
    'User not authorized to apply one or more of these tags': 'tags:apiErrors.notAuthorizedTags',
    'User not authorized to modify one or more of these words': 'tags:apiErrors.notAuthorizedWords',
    'User not authorized to add one or more of these words': 'tags:apiErrors.notAuthorizedToAddWords',
    'You already own this tag': 'tags:apiErrors.alreadyOwnTag',
    'Please specify label for tag': 'tags:apiErrors.labelRequired',
    'You already have a tag with this label.': 'tags:apiErrors.labelAlreadyInUse',
    'Invalid visibility status': 'tags:apiErrors.invalidVisibility',
    'Invalid cursor': 'tags:apiErrors.invalidCursor',
};

/** The i18n key for whatever the backend threw. Never throws; always returns a key. */
export function tagErrorKey(error: unknown): string {
    const message = getApiErrorMessage(error);
    if (message && message in MESSAGE_TO_KEY) return MESSAGE_TO_KEY[message];
    return GENERIC_ERROR_KEY;
}
