const mongoose = require('mongoose')

const tagWordSchema = mongoose.Schema(
    {
        tagId:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Tag',
        },
        wordId:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Word',
        },
    },
    {
        timestamps: true
    }
)

// this only allows a single instance of each tagId-wordId combo
tagWordSchema.index({ tagId: 1, wordId: 1}, { unique: true })

module.exports = mongoose.model('TagWord',  tagWordSchema)