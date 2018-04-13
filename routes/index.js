'use strict';
module.exports = function(app) {
	app.get('/', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/col');
		}else{
			res.render('pages/login');
		}
	});

	app.get('/uploadData', function(req, res) {
		if(req.session.username || req.session.company !=null){
			res.render('pages/upload');
		}else{
			res.render('pages/login');
		}	
	});
	app.get('/signup', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/col');
		}else{
			res.render('pages/login');
		}	
	});
	app.get('/forgot', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/col');
		}else{
			res.render('pages/forgot');
		}	
	});
	app.get('/reset', function(req, res) {
		if(req.session.token && req.session.valid){
			//console.log ("Token value in index.js: " + req.session.token + "is valid? " + req.session.valid);
			res.render('pages/reset');
		}else{
			req.flash('error', 'Password has expired,please re-enter email');
			res.render('pages/forgot');
		}	
	});
	app.get('/about', function(req, res) {
		res.render('pages/about');
	});
	app.get('/primer', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/primer');
		}else{
			res.redirect('/');
		}
	});
	app.get('/col', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/col');
		}else{
			res.redirect('/');
		}
	});

	app.get('/team', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/team');
		}else{
			res.redirect('/');
		}
	});
	
	app.get('/upload', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/upload');
		}else{
			res.redirect('/');
		}
	});
/* 	app.get('/company', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/company');
		}else{
			res.redirect('/');
		}
	}); */
	/* app.get('/industry', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/industry');
		}else{
			res.redirect('/');
		}
	}); */
	app.get('/profile', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/profile');
		}else{
			res.redirect('/');
		}
	});
	app.get('/demarcate', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/demarcate');
		}else{
			res.redirect('/');
		}
	});
	
	app.get('/vehicle-profile', function(req, res) {
		if(req.session.username !=null){
			res.render('pages/vehicle-profile');
		}else{
			res.redirect('/');
		}
	});

};