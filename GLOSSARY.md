# Ladu

A multilingual vocabulary manager for polyglots. One concept is stored with its translations in many languages at once.

## Language

**Word**:
One concept (for example "to dance") that holds Translations in two or more languages.
_Avoid_: Entry, term, card

**Translation**:
The Word written in one language, with all its grammatical Cases (for example Spanish *bailar*).
_Avoid_: Word (for a single-language string), meaning

**Case**:
One grammatical entry inside a Translation: a conjugated or declined form, or an attribute such as gender (for example "1st person singular present"). The term is wider than linguistic "case", and it is kept so that code and user-facing wording stay the same.
_Avoid_: Form, field, inflection
