import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR_KEY, tagErrorKey } from './errors';

/** Shape an axios-style error carrying the backend's `{ message }` body. */
const apiError = (message: string) => ({ response: { status: 400, data: { message } } });

describe('tagErrorKey', () => {
    it.each([
        ['Tag not found', 'tags:apiErrors.tagNotFound'],
        ['User not authorized', 'tags:apiErrors.notAuthorized'],
        ['User not authorized to delete this tag', 'tags:apiErrors.notAuthorizedToDelete'],
        ['User not authorized to follow this tag', 'tags:apiErrors.notAuthorizedToFollow'],
        ['User not authorized to clone this tag', 'tags:apiErrors.notAuthorizedToClone'],
        [
            'User not authorized to apply one or more of these tags',
            'tags:apiErrors.notAuthorizedTags',
        ],
        [
            'User not authorized to modify one or more of these words',
            'tags:apiErrors.notAuthorizedWords',
        ],
        [
            'User not authorized to add one or more of these words',
            'tags:apiErrors.notAuthorizedToAddWords',
        ],
        ['You already own this tag', 'tags:apiErrors.alreadyOwnTag'],
        ['Please specify label for tag', 'tags:apiErrors.labelRequired'],
        ['You already have a tag with this label.', 'tags:apiErrors.labelAlreadyInUse'],
        ['Invalid visibility status', 'tags:apiErrors.invalidVisibility'],
        ['Invalid cursor', 'tags:apiErrors.invalidCursor'],
    ])('maps %j → %j', (message, key) => {
        expect(tagErrorKey(apiError(message))).toBe(key);
    });

    it('falls back to the generic key for an unrecognised message', () => {
        expect(tagErrorKey(apiError('some brand new backend message'))).toBe(GENERIC_ERROR_KEY);
    });

    it('falls back to the generic key when there is no api error body', () => {
        expect(tagErrorKey(new Error('network down'))).toBe(GENERIC_ERROR_KEY);
        expect(tagErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    });
});
