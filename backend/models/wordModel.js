const mongoose = require('mongoose')

const wordSchema = mongoose.Schema(
    {
        user:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        partOfSpeech:{
            type: String,
            required: true,
        },
        translations:{
            type: [{
                language: String,
                cases: [{
                    word: {type: String},
                    caseName: {type: String},
                    _id: false
                }]
            }],
            required: true,
        },
        clue: {
            type: String,
        },
        isCloned: {
            type: Boolean,
            default: false
        },
        originalCreator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    },
    {
        timestamps: true,
    }
)

wordSchema.virtual('words', {
    ref: 'TagWord',
    localField: '_id',
    foreignField: 'wordId'
})

module.exports = mongoose.model('Word',  wordSchema)