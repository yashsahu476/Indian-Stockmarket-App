const mongoose = require('mongoose');

const Portfolioschema = new mongoose.Schema({
    uname: String, 
    code: String,
    name: String,
});

module.exports = mongoose.model("Portfolio", Portfolioschema); 
