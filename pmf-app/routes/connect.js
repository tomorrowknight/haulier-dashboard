var mysql = require('mysql');
'use strict';
var connection = mysql.createConnection({
	host     : 'localhost', //mysql database host name
	user     : 'root', //mysql database user name
	password : 'moeproject16db!', //mysql database password
	database : 'tracks_dev', //mysql database name
	dateStrings: true,
	multipleStatements: true
});

connection.connect(function(err) {
	if (err) throw err;
	console.log('You are now connected...');
})

module.exports=connection;