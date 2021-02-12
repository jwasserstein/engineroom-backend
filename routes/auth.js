const express                = require('express'),
	  router                 = express.Router({mergeParams: true}),
	  db                     = require('../models'),
	  bcrypt                 = require('bcrypt'),
	  {isUserLoggedIn}       = require('../middleware/auth'),
	  jwt                    = require('jsonwebtoken'),
	  {checkMissingFields}   = require('../utils'),
	  mongoose               = require('mongoose');

router.post('/signup', async function(req, res) {
	try {
		const missingFields = checkMissingFields(req.body, ['username', 'password', 'firstName', 'lastName']);
		if(missingFields.length){
			return res.status(400).json({error: 'Missing the following fields: ' + missingFields});
		}
		
		const existingUser = await db.Users.findOne({username: req.body.username});
		if(existingUser) return res.status(400).json({error: 'That username is already in use'});

		const user = await db.Users.create({
			username: req.body.username,
			password: req.body.password, // Password is salted/hashed in pre-save hook
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			friends: ['60251c79d3f1260004db5452', '60257901e61a5d0004c81830', '60257c3fe61a5d0004c81832', '602586a9e61a5d0004c8183a']
		});
		const token = jwt.sign({
			id: user._id,
			username: user.username
		}, process.env.SECRET_KEY);
		const userObj = user.toObject();
		delete userObj.password;

		return res.status(201).json({
			id: user._id,
			username: user.username,
			users: [userObj],
			token
		});
	} catch (err) {
		return res.status(500).json({error: err.message});
	}
});

router.post('/signin', async function (req, res) {
	try {
		const missingFields = checkMissingFields(req.body, ['username', 'password']);
		if(missingFields.length){
			return res.status(400).json({error: 'Missing the following fields: ' + missingFields});
		}
		
		const user = await db.Users.findOne({username: req.body.username});
		if(!user){
			return res.status(401).json({error: "That username doesn't exist"});
		}
		const isMatch = await bcrypt.compare(req.body.password, user.password);
		if(isMatch){
			const token = jwt.sign({
				id: user._id,
				username: user.username
			}, process.env.SECRET_KEY);

			const userObj = user.toObject();
			delete userObj.password;
			return res.json({
				id: user._id,
				username: user.username,
				users: [userObj],
				token
			});
		} else {
			return res.status(401).json({error: 'Incorrect password'});
		}
	} catch (err) {
		return res.status(500).json({error: err.message});
	}
});

router.post('/changePassword', isUserLoggedIn, async function(req, res){
	try {
		const missingFields = checkMissingFields(req.body, ['currentPassword', 'newPassword', 'repeatNewPassword']);
		if(missingFields.length){
			return res.status(400).json({error: 'Missing the following fields: ' + missingFields});
		}
		if(req.body.newPassword !== req.body.repeatNewPassword){
			return res.status(400).json({error: 'New passwords must match'});
		}
	
		const user = await db.Users.findById(res.locals.user.id);
		const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
		if(!isMatch){
			return res.status(401).json({error: 'Incorrect password'});
		}
		user.password = req.body.newPassword; // pre-save hook will salt & hash
		user.save();
		
		const message = 'Successfully changed your password';
		return res.json({message});
	} catch (err) {
		return res.status(500).json({error: err.message});
	}
});

module.exports = router;