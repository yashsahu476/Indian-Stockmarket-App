// if(process.env.NODE_ENV !== "production"){
//     require('dotenv').config();
// }

const express = require('express');
const fetch  = require('node-fetch');
const ejsMate = require('ejs-mate');
const app = express();
const path = require("path");
const mongoose = require('mongoose');
const Stockmarket = require('./models/stockmodel');
const Stockuser = require('./models/usermodel');
const flash = require('connect-flash');
const passport = require('passport');
const localStrategy = require('passport-local');
const catchAsync = require('./utilities/catchAsync');
const ExpressError = require('./utilities/ExpressErrors');
const session =  require('express-session');
const {isLoggedIn} = require('./middleware');
const Review = require('./models/review');
const methodOverride = require('method-override');
const Portfolio = require('./models/portfoliomodel');


var bseCode, theUser;

const dbURL = 'mongodb://localhost:27017/Stock';
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/Stock', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });

        console.log('MongoDB connected!!');
    } catch (err) {
        console.log('Failed to connect to MongoDB', err);
    }
};

connectDB();

// mongoose.connect('mongodb://localhost:27017/Stock', {
//     useNewUrlParser: true, 
//     useUnifiedTopology: true,
//     useCreateIndex: true
// }).then(()=>{                             
//     console.log("Database Connected!!");
// })
// .catch(err =>{
//     console.log("Connection Error!!");
//     console.log(err);
// });

app.engine('ejs', ejsMate); 
app.set('view engine','ejs');  
app.set('views',path.join(__dirname,'views'));


app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));


const sessionConfig={
    secret: 'thisissecret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000*60*60*24*7,
        maxAge:  1000*60*60*24*7
    }
}
app.use(session(sessionConfig));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(Stockuser.authenticate()));

passport.serializeUser(Stockuser.serializeUser());
passport.deserializeUser(Stockuser.deserializeUser());

// var port = 1880;


app.use((req,res,next) => {
    res.locals.currentUser = req.user;
    theUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

var myJSON;

app.delete('/bse/portfolio/delete/:id', catchAsync(async(req,res) => {
    myJSON = JSON.stringify(theUser);
    const {id} = req.params;
    const allPortfolio = await Portfolio.findOneAndDelete({uname: myJSON, code: id});
    req.flash('success', 'The share has been deleted from your portfolio');
    res.redirect('/bse/portfolio');
}));
app.post('/bse/portfolio', isLoggedIn, catchAsync(async(req,res)=> {
      const xCode = req.body.share.api;
      const xName = req.body.share.name;
       myJSON = JSON.stringify(theUser);
      const portfolio = new Portfolio({uname: myJSON, code: xCode, name: xName});
      await portfolio.save();
      req.flash('success', `${xName} has been added to your portfolio`);

      res.redirect('/bse/stockmarket');
}));

app.get('/bse/portfolio', isLoggedIn, async(req,res) => {
    myJSON = JSON.stringify(theUser);
    const allPortfolio = await Portfolio.find({uname: myJSON});
    res.render('portfolio.ejs',{ allPortfolio });
});

app.get('/bse/share/:id/reviews/:reviewId/edit', async(req,res) => {
    bseCode = req.params.id;
    const review = await Review.findById(req.params.reviewId);
    res.render('editReview.ejs',{review, bseCode});
});

app.put('/bse/share/:id/reviews/:reviewId/edit', catchAsync(async(req,res)=> {
    const {id, reviewId} = req.params;
    const review = await Review.findByIdAndUpdate(reviewId, { ...req.body.review});
    req.flash('success', 'Your opinion has been updated');
    res.redirect(`/bse/share/${id}`);
}));

app.delete('/bse/share/:id/reviews/:reviewId', isLoggedIn, catchAsync(async(req,res) => {
    const {id, reviewId } = req.params;
    await Stockmarket.findOneAndUpdate({code: id}, {$pull: {reviews: reviewId} });
    await Review.findByIdAndDelete(reviewId);
    req.flash('success', 'Your opinion has been deleted');
    res.redirect(`/bse/share/${id}`);
}));

app.get('/bse/signout',(req,res) => {
    req.logout();
    req.flash('success', 'Successfully logged you out!');
    res.redirect('/bse/stockmarket');
});

app.get('/bse/share/:id',async(req,res) => {
    const shareResult = await Stockmarket.findOne({code: req.params.id}).populate('reviews');
    const code = req.params.id;
    await fetch(`https://www.quandl.com/api/v3/datasets/BSE/${req.params.id}.json?start_date=2018-11-22&end_date=2021-06-11&api_key=doYHMguM2PQsxYxNwTCt`)
    .then((respond) => respond.json())
      .then(json => res.render('shareInfo.ejs',{ json, code, shareResult, theUser}))
});

app.post('/bse/share/:id/reviews', isLoggedIn, catchAsync(async(req,res) => {
    const shareReview = await Stockmarket.findOne({code: req.params.id});
    const review = new Review(req.body.review);
    shareReview.reviews.push(review);
    await review.save();
    await shareReview.save();
    req.flash('success', 'Your opinion has been registered');
    res.redirect(`/bse/share/${req.params.id}`);
}));

app.get('/bse/signup', (req,res) => {
    res.render('signup.ejs');
});

app.post('/bse/signup',catchAsync(async(req,res,next) => {
    try{
        const {username, password}= req.body;
        theUser = username;
    const user = new Stockuser({username, password});
    const newUser = await Stockuser.register(user, password);
    req.login(newUser, err => {
          if(err) 
          return next(err);
          req.flash('success','You have succesfully registered yourself');
          res.redirect('/bse/stockmarket');
    })   
    }catch(e){
        req.flash('error', e.message);
        res.redirect('/bse/signup');
    }
}));

app.get('/bse/login',(req,res) => {
    res.render('login.ejs');
});

app.post('/bse/login', passport.authenticate('local',{ failureFlash: true,  failureRedirect: '/bse/login' }), async(req,res) => {
     try{
         const {username} = req.body;
         theUser = username;
        req.flash('success', 'Welcome Back, Good to see you again here!!');
        res.redirect('/bse/stockmarket');
     }catch(e){
        req.flash('error',e.message);
        res.redirect('/bse/login');
    }
})

app.get('/bse/stockmarket', (req,res) => {
    res.render('stockmarket.ejs');
});

app.get('/bse/home',(req,res) => {
    res.render('home.ejs');
});

app.post('/bse/shareinfo', (req,res) => {
     bseCode= req.body.share.api;
     res.redirect(`/bse/share/${bseCode}`);
});

app.use('*',(req,res,next) => {
    next(new ExpressError('Page not found', 404));
});

app.use((err,req,res,next) => {
    const {statusCode = 500} = err;
    if(!err.message){
        err.message = 'Something went wrong';
    }
    res.status(statusCode).render("error",{ err });
    res.send("I get things are bad, need to fix it!!");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`listening at port number ${port}`);
});