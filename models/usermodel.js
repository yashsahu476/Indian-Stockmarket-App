const mongoose = require('mongoose');
const passportLocalMongoose =require('passport-local-mongoose');
const userschema = new mongoose.Schema({
   
});

userschema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Stockuser", userschema); 
