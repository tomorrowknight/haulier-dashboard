//Password reset method
/* require('../main.js'); */
var connection = require('./connect.js');
var crypto = require('crypto');
var async = require('async');
var bcrypt = require('bcrypt');
var nodemailer = require('nodemailer');

module.exports = function(app) {
	//forgot password mail sending and checker
	app.post('/forgot', function(req, res, next) {
		var noSuchEmail = "Your email does not exist in our records";
		async.waterfall([
			function(done) {
			  crypto.randomBytes(20, function(err, buf) {
				var token = buf.toString('hex');
				done(err, token);
			  });
			},
			function(token, done){
				var user = new Object();
				getUserEmail(req.body.email,function(err,data){
					user.email = data;
					if (!user.email) {
						res.json({ message: noSuchEmail });
					  //res.flash('error', 'No account with that email address exists.');
					  //return res.redirect('/forgot');
					}
					console.log(user.email);
					var resetPasswordToken = token;
					var resetPasswordExpires = Date.now() + 3600000; // 1 hour
					var toDate = new Date(resetPasswordExpires);
					var dbFmtDate = toDate.toString("yyyy-MM-dd HH:mm:ss");
					done(err,token,user.email);
					setUserToken(user.email,resetPasswordToken,dbFmtDate,function(err,data){
						console.log(err);
						if(!err){
							done(data,token,user.email);
						}
						
					});
				});
		},
		//if valid,send an email
		function(token, email, done) {
		if(email!=""){
			var fmtEmail = email.replace(/"/g,"");
			const mailjet = require ('node-mailjet').connect("2060026e17c7ffe907abd433726075a2", "30bb88cb1c32a27446ef1a57107be285")
			const request = mailjet.post("send")
				.request({
					"FromEmail":"easiplanner.dev@gmail.com",
					"FromName":"Haulier Dashboard Team",
					"Subject":"Password Reset request - Haulier Dashboard ",
					"Text-part":"You have requested a change of password. Do NOT click if this action was not done by you.",
					"Html-part":"<h6>http://" + req.headers.host + "/reset/" + token +"</h6><br />",
					"Recipients":[{"Email": fmtEmail}]
				})
				request
				.then(result => {
					console.log(result.body)
					res.redirect('/');
				})
				.catch(err => {
					console.log(err.statusCode)
				})
				req.flash('successMessage', 'An e-mail has been sent to ' + email + ' with further instructions.');
				//req.flash('info', 'An e-mail has been sent to ' + email + ' with further instructions.');
				}
		}
	  ]);
	});
	
	//check if the user email exists in the system
	function getUserEmail(userEmail,callback){
		connection.query('select * from user where email=?', [userEmail], function (error, results, fields) {
			if (error){
				callback(error,null);
			}
			if(results.length>0){
				callback(null,JSON.stringify(results[0].email));
			}else{
				callback(null,"");
			}
		});
	}

	//Set the expiry token for resetting a password
	function setUserToken(email,token,expiryDate,callback){
		var val = "";
		var fmtEmail = email.replace(/"/g,"")
		console.log(expiryDate);
		connection.query('UPDATE user SET `reset_token`=?,`token_expiry`=? WHERE email=?', [token,expiryDate,fmtEmail], function (error, results, fields) {
			if (error){
				callback(error,null);
			}
			if(results.length>0){
				callback(null,results[0]);
			}
		});
	}
	
	//User signs up for the application
	app.post('/signUp', function (req, res) {
		username = req.body.username;
		pwd = req.body.pwd;
		companySelect = req.body.company;
		userEmail = req.body.email;
		var salt = bcrypt.genSaltSync(saltRounds);
		var hash = bcrypt.hashSync(pwd, salt);
		connection.query('INSERT INTO user SET `username`=?,`password`=?,`company`=?,`email`=?', [username,hash,companySelect,userEmail], function (error, results, fields) {
			if (error){
				res.redirect('/signUp');
			}else{
				res.redirect('/');	
			}
			
		});
	});

	//Verify if the user is valid
	app.post('/verifyLogin', function (req, res) {
		username = req.body.username;
		pwd = req.body.pwd;
		errMsg = "";
		errType = "";
		connection.query('SELECT * FROM user WHERE `username`=?' , [username], function (error, results, fields) {
			if (error) throw error;
			if(results[0] != null){
				var company = results[0].company;
				var dbHash = results[0].password;
				if(bcrypt.compareSync(pwd, dbHash)){
					req.session = req.session;
					req.session.username = username;
					req.session.company = company;
					res.redirect('/col');
				}else{
					res.redirect('/');  
				}
			}else{
				res.redirect('/');
			}
		}); 
	});
	
	app.get('/reset/:token', function(req, res) {
		var toDate = new Date(Date.now());
		req.session = req.session;
		var resetToken = req.params.token;
		req.session.token = resetToken;
		console.log("TESTTTTT");
		console.log(resetToken);
		var currentDateTime = toDate.toString("yyyy-MM-dd HH:mm:ss");
		connection.query('SELECT COUNT(*) AS valid FROM user where`reset_token`=? AND`token_expiry`>?', [req.params.token,currentDateTime], function (error, results, fields) {
		if (error){
			throw error;
		}
		if(results[0].valid != 0){
			var isValid = true;
			req.session.valid = isValid
			res.redirect('/reset');
		}else{
			console.log()
			return res.redirect('/forgot');
		}
		});
	});

	app.post('/change', function(req, res) {
		var newPwd = req.body.password;
		var resetToken = req.session.token;
		var toDate = new Date(Date.now());
		var currentDateTime = toDate.toString("yyyy-MM-dd HH:mm:ss");
		var salt = bcrypt.genSaltSync(saltRounds);
		var hash = bcrypt.hashSync(newPwd, salt);
		connection.query('UPDATE user SET `password`=?,`token_expiry`=? where`reset_token`=? AND`token_expiry`>?', [hash,currentDateTime,resetToken,currentDateTime], function (error, results, fields) {
		if (error){
			throw error;
		}
		resetToken = null;
		req.session.token = null;
		return res.redirect('/');
		});
	});
}
