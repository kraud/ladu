const mongoose= require('mongoose')

const exercisePerformanceSchema = mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    translationId: mongoose.Schema.Types.ObjectId,
    // wordId es para ayudar a identificar exactamente la palabra a la que pertenece el translationId,
    // para simplificar consulta de creación de ejercicios (antes translationId se mantenía al clonar tag, ahora se genera uno nuevo)
    word: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    // NB! We'll use record.length & % of correct answers (true) + lastDate to calculate a "level of remembrance"
    // and sort translations to use by that metric, to encourage practicing different translations.
    // Example: if lastDate > 6 months ago => amount of correct answers counts as half (or some other calculation).
    statsByCase: {
        type:[{
            _id: false,
            caseName: String,
            record: [Boolean],
            lastDate: {
                type: Date
            },
            knowledge:{
                type: Number
            }
        }]
    },
    performanceModifier: {
        type: String, // 'Mastered' | 'Revise'
        enum: ['Mastered', 'Revise']
    },
    // Keeps track of correct answers since user marked as revised
    reviseCounter:{
        type: Number
    },
    // average-aged-knowledge of the cases stored in this translation
    // (they are already aged, to reflect the status of the translation at the time of last update to it)
    averageTranslationKnowledge:{
        type: Number
    },
    lastDateModifiedTranslation:{
        type: Date
    },
    translationLanguage: {
        type: String,
    },
},{
    timestamps: true
})

exercisePerformanceSchema.index({ user: 1, word: 1 });

module.exports = mongoose.model('ExercisePerformance',  exercisePerformanceSchema)
