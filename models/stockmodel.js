const mongoose = require('mongoose');

const Stockschema = new mongoose.Schema({
    code: String,
    apiUrl: String,
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Review'
        }
    ]
});

module.exports = mongoose.model("Stockmarket", Stockschema); 
