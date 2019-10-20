// Necessary Box Imports
const appConfig = require("./config");
const boxSDK = require("box-node-sdk");
const querystring = require("querystring");
var passport = require("passport"), BoxStrategy = require("passport-box").Strategy;

// Setting Up Express 
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");
var app = express();
app.use(cors());
app.use(bodyParser.json());
const PORT = 5000;

// Set up express middleware to be able to handle box requests
passport.use(new BoxStrategy({
    clientID: appConfig.oauthClientId, 
    clientSecret: appConfig.oauthClientSecret, 
    callbackURL: "http://localhost:3000/authenticated"
    },
    function(accessToken, refreshToken, profile, done)
    {
        User.findOrCreate({ boxId: profile.id }, function(err, user)
        {
            return done(err, user);
        })
    }
))

app.get("/login", (req, res) => 
{    
    passport.authenticate("box", { failureRedirect: "/login" }),
    function(req, res) 
    {
        res.redirect("/");
    };
});

app.listen(PORT, function()
{
    console.log("Listening on port " + PORT + "!");
});