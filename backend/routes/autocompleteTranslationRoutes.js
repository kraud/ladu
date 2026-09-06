const express = require('express')
const router = express.Router()
const { getVerbES, getVerbDE, getNounDE,
    getNounGenderES, getVerbEN, getVerbEE, getNounEE, getAdjectiveEE
} = require('../controllers/autocompleteTranslationController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/english/verb/:infinitiveVerb', protect, getVerbEN)

router.get('/spanish/verb/:infinitiveVerb', protect, getVerbES)
router.get('/spanish/noun/:singularNominativeNoun', protect, getNounGenderES)

router.get('/german/verb/:infinitiveVerb', protect, getVerbDE)
router.get('/german/noun/:singularNominativeNoun', protect, getNounDE)

router.get('/estonian/verb/:infinitiveMaVerb', protect, getVerbEE)
router.get('/estonian/noun/:singularNominativeNoun', protect, getNounEE)
router.get('/estonian/adjective/:singularAdjective', protect, getAdjectiveEE)

module.exports = router