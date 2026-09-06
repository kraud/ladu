const Word = require('../models/wordModel')

const calculateBasicUserMetrics = async (user) => {
    let userId = user._id
    // determines amount of languages of user
    const userLanguages = user.languages !== undefined ? user.languages : []

    // Pipeline que usa facet, es decir, consultas paralelas.
    const metricsPipeline = [
        // ObjectId('64163ace3bd498bd734db75a') <= Admin dude en base de producción
        {
            $match: { user: userId }
        },
        {
            $facet: {
                translationsByLanguage: [
                    { $unwind: "$translations" },
                    {
                        $group: {
                            _id: "$translations.language",
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            language:"$_id",
                            type:"language"
                        }
                    }
                ],
                translationsByLanguageAndPOS: [
                    { $unwind: "$translations" },
                    {
                        $group: {
                            _id: {
                                language:"$translations.language",
                                partOfSpeech:"$partOfSpeech"
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            label:"$_id.language",
                            type:"language", //determines that in 'label' comes the language. So it can be translated accordingly
                            partOfSpeech: "$_id.partOfSpeech"
                        }
                    }
                ],
                wordsPerPOS: [
                    {
                        $group: {
                            _id: "$partOfSpeech",
                            // if we want amount of incomplete words by POS
                            /* incompleteWordsCount: {
                                 $sum: {
                                     $cond: { if: { $eq: [ { $size: "$translations" }, userLanguages ] }, then: 1, else: 0 }
                                 }
                            }, */
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $addFields: {
                            partOfSpeech: "$_id",
                            type:"partOfSpeech"
                        }
                    }
                ],
                wordsPerMonth: [
                    {
                        $group: {
                            _id: {
                                year: {$year: "$createdAt"},
                                month: { $dateToString: { format: "%m",  date: "$createdAt" } },
                                partOfSpeech: "$partOfSpeech"
                            },
                            count: {
                                $sum: 1
                            }
                        }
                    },
                    {
                        $addFields: {
                            label:{
                                $concat: [{$toString : "$_id.year"},"-", {$toString : "$_id.month"}]
                            },
                            partOfSpeech: "$_id.partOfSpeech"
                        }
                    },
                    {
                        $sort: {
                            _id: 1 /* ascending order */
                        }
                    }
                ],
                totalWords: [
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            incompleteWordsCount: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $eq: [
                                                { $size: { $setIntersection: [ "$translations.language", userLanguages ] } }
                                                , userLanguages.length
                                            ]
                                        },
                                        then: 0,
                                        else: 1
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                translationsByLanguage: 1,
                translationsByLanguageAndPOS: 1,
                wordsPerPOS: 1,
                wordsPerMonth: 1,
                totalWords: { $arrayElemAt: ["$totalWords.count", 0] },
                incompleteWordsCount: { $arrayElemAt: ["$totalWords.incompleteWordsCount", 0] }
            }
        }
    ];
    const metricPipelineResult = await Word.aggregate(metricsPipeline);
    return metricPipelineResult[0]
}


module.exports = {
    calculateBasicUserMetrics
}
