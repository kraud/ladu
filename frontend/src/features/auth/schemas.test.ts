import { describe, expect, it } from 'vitest';
import type { ObjectSchema } from 'yup';
import {
    buildLoginSchema,
    buildRegisterSchema,
    buildResetRequestSchema,
    buildResetSchema,
    buildResetSetSchema,
} from './schemas';

/** Identity translate — asserts on i18n *keys*, the same way the old app didn't. */
const t = (key: string) => key;

async function errorsOf(schema: ObjectSchema<never>, value: unknown): Promise<string[]> {
    try {
        await schema.validate(value, { abortEarly: false });
        return [];
    } catch (error) {
        return (error as { errors: string[] }).errors;
    }
}

describe('buildLoginSchema', () => {
    const schema = buildLoginSchema(t) as unknown as ObjectSchema<never>;

    it('requires email and password', async () => {
        expect(await errorsOf(schema, {})).toEqual(
            expect.arrayContaining([
                'loginRegister:errors.emailRequired',
                'loginRegister:errors.passwordRequired',
            ]),
        );
    });

    it('rejects a malformed email', async () => {
        expect(await errorsOf(schema, { email: 'not-an-email', password: 'x' })).toContain(
            'loginRegister:errors.invalidEmail',
        );
    });

    it('accepts a well-formed pair', async () => {
        expect(await errorsOf(schema, { email: 'a@b.com', password: 'secret' })).toEqual([]);
    });
});

describe('buildRegisterSchema', () => {
    const schema = buildRegisterSchema(t) as unknown as ObjectSchema<never>;

    it('enforces the 8-char minimum password', async () => {
        expect(
            await errorsOf(schema, {
                name: 'A',
                username: 'a',
                email: 'a@b.com',
                password: 'short',
                password2: 'short',
            }),
        ).toContain('loginRegister:errors.passwordMin');
    });

    it('requires the confirmation to match', async () => {
        expect(
            await errorsOf(schema, {
                name: 'A',
                username: 'a',
                email: 'a@b.com',
                password: 'longenough',
                password2: 'different',
            }),
        ).toContain('loginRegister:errors.passwordRepeatMustMatch');
    });

    it('accepts a complete, matching payload', async () => {
        expect(
            await errorsOf(schema, {
                name: 'Ada',
                username: 'ada',
                email: 'ada@b.com',
                password: 'longenough',
                password2: 'longenough',
            }),
        ).toEqual([]);
    });
});

describe('buildResetSchema — mode-conditional', () => {
    it('request mode validates only email', async () => {
        const schema = buildResetSchema(t, false) as unknown as ObjectSchema<never>;
        expect(Object.keys(schema.fields)).toEqual(['email']);
        expect(await errorsOf(schema, {})).toEqual(['loginRegister:errors.emailRequired']);
    });

    it('set mode validates only password + confirmation', async () => {
        const schema = buildResetSchema(t, true) as unknown as ObjectSchema<never>;
        expect(Object.keys(schema.fields).sort()).toEqual(['password', 'password2']);
        expect(await errorsOf(schema, { password: 'longenough', password2: 'nope' })).toContain(
            'loginRegister:errors.passwordRepeatMustMatch',
        );
    });

    it('delegates to the request/set builders', () => {
        expect(Object.keys(buildResetRequestSchema(t).fields)).toEqual(['email']);
        expect(Object.keys(buildResetSetSchema(t).fields).sort()).toEqual(['password', 'password2']);
    });
});
