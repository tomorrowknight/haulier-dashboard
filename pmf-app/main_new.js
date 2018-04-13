var http = require('http');
var fs = require('fs');
// var https = require('https');
var express = require('express');
var session = require('express-session');
var app = express();
var XLSX = require('xlsx');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var routes = require('./routes/index.js');
const fileUpload = require('express-fileupload');
var chart = require('chart.js');
//var flash = require('express-flash');
var flash = require('req-flash');
var bcrypt = require('bcrypt');
require('datejs');
var nodemailer = require('nodemailer');
var copy = require('copy');
var crypto = require('crypto');
var async = require('async');
var fetch = require('node-fetch');
var now = require("performance-now");
var schedule = require('node-schedule');
var Excel = require('exceljs');
var DEL = require('node-delete');
const saltRounds = 12;


//start mysql connection
var connection = mysql.createConnection({
	host     : 'localhost', //mysql database host name
	user     : 'root', //mysql database user name
	password : 'moeproject16db!', //mysql database password
	database : 'tracks', //mysql database name
	dateStrings: true,
	multipleStatements: true
});

connection.connect(function(err) {
	if (err) throw err
	console.log('You are now connected...')
})
//end mysql connection

//start body-parser configuration
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));
//end body-parser configuration

//for future https use
/* var options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/key-cert.pem')
};
 */
//var server = https.createServer(options,app);
//create app server
var server = app.listen(3000,"dev.logistics.lol", function () {

	var host = server.address().address
	var port = server.address().port

	console.log("HPD app listening at http://%s:%s", host, port)
	var today = new Date();
	console.log("Time now is: " + today);

});

app.use(session({
secret: 'pmfcoiscm',
resave: false,
saveUninitialized: false,
duration: 360000,
activeDuration: 600000,
cookie: { maxAge: 900000 }
}));
app.use(flash());
app.use(function(req, res, next){
/*     res.locals.success_messages = req.flash();
    res.locals.error_messages = req.flash('error_messages'); */
	res.locals.err_msg = req.session.errMsg;
	res.locals.err_type = req.session.errType;
    next();
});

app.use(fileUpload());


var sess;



/* app.get('/login',function(req,res){
sess = req.session;
sess.username;
//Session set when user Request our app via URL
if(sess.username) {

	res.redirect('/col');
}
else {
	res.render('/login');
}
}); */

//Password reset method
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
  //res.redirect('/forgot');
});

function wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
  }
}

//Remove after testing
//removeLargeGaps("2017-07-04","2017-07-05","XD4626M","AW");
var hvsDist = haversineDistance(1.366446,103.866536,1.363378,103.866644,false);
console.log("Straight Line Dist: " + hvsDist);

var j = schedule.scheduleJob("*/3 * * * *", function(){
	getFirstDate();
	
});


//New methods
function getUtilTimeX(dateStart,dateEnd,vehicleNum,company){
		var nodeArr = [];
		var speedMin = 0;
		var speedMax = 90;
		var totalWorkingTime = 0;
		var driverErrSpeed = 1;
		return new Promise(function(resolve, reject) {
		var q = 'SELECT DISTINCT datetime,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND company=? AND speed BETWEEN ? and ? ORDER BY id,datetime' ;
		var sqlQuery = connection.query(q,[dateStart,dateEnd,vehicleNum,company,speedMin,speedMax], function (error, results, fields) {
		if (error) throw error;
			if(results.length){
				var startTime = "";
				var endTime = "";
				for(var st=0;st<results.length;st++){
					if(results[st].speed > driverErrSpeed){
						startTime = results[st].datetime;
						break;
					}
				}
				
				for (var end=results.length-1;end>0;end--){
					if(results[end].speed > driverErrSpeed){
						endTime = results[end].datetime;
						break;
					}
				}
				if (error) {
					return reject(error);
				}
				var utStart = Date.parse(startTime).getTime()/1000;
				var utEnd = Date.parse(endTime).getTime()/1000;
				console.log("Start Time: " + utStart);
				console.log("End Time: " + utEnd);
				var hour = 3600;
				var fullDay = 3600*24;
				totalWorkingTime = (utEnd-utStart)/60;
				//totalWorkingTime = (utEnd-utStart);
				//console.log("Total Wk time? : " +totalWorkingTime);
				var utilTimeX = totalWorkingTime;
				resolve(utilTimeX);
			}else{
				
			}
		});
	});
}

function storeProcessedData(date,vehicle,utilTime,company){
	connection.query('INSERT INTO processed_data SET `date`=?,`vehicle`=?,`work_time`=?,`company`=?', [date,vehicle,utilTime,company], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}

function updateProcessedDataMove(moveTime,date,vehicle){
	connection.query('UPDATE processed_data SET `move_time`=? WHERE `date`=? AND `vehicle`=?', [moveTime,date,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}

function updateProcessedDataStop(stopTime,date,vehicle){
	connection.query('UPDATE processed_data SET `unknown_stop`=? WHERE `date`=? AND `vehicle`=?', [stopTime,date,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}

function updateProcessedDataService(serviceTime,date,vehicle){
	connection.query('UPDATE processed_data SET `service_time`=? WHERE `date`=? AND `vehicle`=?', [serviceTime,date,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}
function updateProcessedDataTravelDistance(travelDistance,date,vehicle){
	connection.query('UPDATE processed_data SET `travel_distance`=? WHERE `date`=? AND `vehicle`=?', [travelDistance,date,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}

function checkDataReplication(date1,date2,vehicle,company,outputFileName){
	var count = 0;
	var count2 = 0;
	var queries = 'SELECT COUNT(*) AS count FROM `processed_data` WHERE `date` BETWEEN ? AND ? AND vehicle=? AND company=? LIMIT 1;SELECT COUNT(*) AS count2 FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND company=? LIMIT 1';
	return new Promise(function(resolve, reject){
		connection.query(queries,[date1,date2,vehicle,company,date1,date2,vehicle,company], function (error, results, fields) {
			if (error){
				throw error;
			}else{
				count = results[0][0].count;
				count2 = results[1][0].count2;
				console.log("Var count2: " + count2);
				var total = count+count2;
				return resolve(total);
			}
		});
	});
}

function testTotalDist(dateStart,dateEnd,vehicle){
	connection.query('SELECT * FROM `test_node` WHERE `datetime` BETWEEN ? AND ? AND vehicle=?', [dateStart,dateEnd,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}else{
			if(results){
				var totalDist = 0;
				var data = results;
				for(var i=0;i<data.length-1;i++){
					var node = data[i];
					var nextNode = data[i+1];
					var dist = haversineDistance(node.lat,node.lon,nextNode.lat,nextNode.lon,false);
					totalDist += dist;
					
				}
				console.log("TOTAL DIST HVRS: " +totalDist);
			}
		}
	});
}
//testTotalDist("2017-07-11","2017-07-12","XD5756P");
//removeGPSError("2017-07-11","2017-07-12","XD5756P");
function removeGPSError(dateStart,dateEnd,vehicle,company){
	var isTraversed = false;
	var oneDay = 86400000;
	var selQuery = 'SELECT * FROM `node` WHERE `datetime` BETWEEN ? AND ? AND vehicle=? ORDER BY id';
	var updQuery = 'DELETE FROM `node` WHERE id BETWEEN ? AND ? and lat=? ';
	return new Promise(function(resolve, reject){
		connection.query(selQuery,[dateStart,dateEnd,vehicle,company], function (error, results, fields) {
			if (error){
				throw error;
			}else{
				if(results){
					var data = results
					var refNode = data[0];
					for(var i=0;i<data.length-1;i++){
						var thisNode = data[i];
						var nextNode = data[i+1];
						var distBtwnNodes = haversineDistance(thisNode.lat,thisNode.lon,nextNode.lat,nextNode.lon,false);
						var thisNodeDate = Date.parse(thisNode.datetime);
						var nextNodeDate = Date.parse(nextNode.datetime);
						var timeDiff = (nextNodeDate-thisNodeDate)/1000;
						var timeGapInMins = timeDiff/60;
						if(((distBtwnNodes/timeGapInMins)*60)>85){
							var id = nextNode.id;
							var idUB = i+10;
							var idLB = i-3;
							var lat = nextNode.lat;
							connection.query(updQuery,[idLB,idUB,lat], function (error, results, fields) {
								if (error) throw error;
								if(i==data.length-2){
									if(error){
										reject(error);
									}
										resolve(results);
								}
								//refNode = thisNode;
							});
						}else{
							refNode = thisNode;
						}
					}
				}else{
					console.log("No results found");
				}
				//return resolve(isTraversed);
			}
		});
	});	
}



/* function removeDuplicateRows(){
	var sqlStmt = "CREATE TABLE temp_table LIKE node;ALTER TABLE temp_table ADD UNIQUE(datetime);INSERT IGNORE INTO temp_table SELECT * FROM node;RENAME TABLE node TO old_table, temp_table TO node;DROP TABLE old_table";
	connection.query(sqlStmt, function(error, results, fields) {
		if (error) {
			throw error;
		}
	});
} */

function storeProcessedAreas(date,vehicle,fenceData,company){
	console.log("Store Proc Area COY CHK: " + company);
	var svcTime = 0;
	var isDone = 0;
	for(var i=0;i<fenceData.length;i++){
		var fenceType = "";
		svcTime = fenceData[i];
		if(i==0){
			fenceType = "DP";
		}else if(i==1){
			fenceType = "TM";
		}else if(i==2){
			fenceType = "WH";
		}else if(i==3){
			fenceType = "PK";	
		}else if(i==4){
			fenceType = "CU";
		}
		connection.query('INSERT INTO processed_areas SET `date`=?,`vehicle`=?,`service_time`=?,`fence_type`=?,`company`=?', [date,vehicle,svcTime,fenceType,company], function (error, results, fields) {
			if (error){
				throw error;
			}
		});	
	}
	isDone=1;
}

function removeProcessedData(datetime1,datetime2,vehicle){
	connection.query('DELETE FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=?', [datetime1,datetime2,vehicle], function (error, results, fields) {
		if (error){
			throw error;
		}
	});
}

function removeLargeGaps(datetime1,datetime2,vehicle,company){
	var hoursToOmit = 7200000; //epoch time in ms 7200000 is 2 hours
	var sqlQuery = 'SELECT id,datetime,lat,lon FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=?';
	return new Promise(function(resolve, reject) {
		connection.query(sqlQuery, [datetime1,datetime2,vehicle,company], function (error, results, fields) {
			if (error){
				throw error;
			}else{
				if(results.length>0){
					for(var i=0;i<results.length-1;i++){
						var nodeRef = results[i]
						var refDateTimeStr = nodeRef.datetime;
						var idRef = nodeRef.id;
						var latRef = nodeRef.lat;
						var lonRef = nodeRef.lon;
						var node = results[i+1];
						var dateTimeStr = node.datetime;
						var dateTime = Date.parse(dateTimeStr).getTime();
						var refDateTime = Date.parse(refDateTimeStr).getTime();
						var lat = node.lat;
						var lon = node.lon;
						if((dateTime-refDateTime)>hoursToOmit){
							var radius = haversineDistance(latRef,lonRef,lat,lon,false);
							if(radius<5){
								connection.query('DELETE FROM node WHERE `id`<=? AND `datetime` BETWEEN ? AND ? AND `vehicle`=? AND `company`=?', [idRef,datetime1,datetime2,vehicle,company], function (error, results, fields) {
								if (error) throw error;
 									if(error){
										reject(error);
									}
										resolve(results); 
								});	
							}
						}
					}
				}
				
			}
		});
	});	
}
	
function consolidateFenceData(datetime1,datetime2,vehicle,company){
	var fenceData = "";
	var areasArr = [];
	var sqlStmt = "SELECT datetime,fence_type FROM fenced_node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? AND company=? GROUP BY datetime,fence_type ORDER BY datetime,id";
	return new Promise(function(resolve, reject) {
		connection.query(sqlStmt, [datetime1,datetime2,vehicle,company], function (error, results, fields) {
		if(error){
		throw(error)
		}
		if(results.length){
			var svcTime_dp = 0;
			var svcTime_tm = 0;
			var svcTime_wh = 0;
			var svcTime_pk = 0;
			var svcTime_cu = 0;
			
			for(var i=0;i<results.length;i++){
				if(results[i].fence_type == "DP"){
					svcTime_dp++;
				}else if(results[i].fence_type == "TM"){
					svcTime_tm++;
				}else if(results[i].fence_type == "WH"){
					svcTime_wh++;
				}else if(results[i].fence_type == "PK"){
					svcTime_pk++;
				}else if(results[i].fence_type == "CU"){
					svcTime_cu++;
				}
			}
			areasArr.push(svcTime_dp);
			areasArr.push(svcTime_tm);
			areasArr.push(svcTime_wh);
			areasArr.push(svcTime_pk);
			areasArr.push(svcTime_cu);
		}
		//console.log(results);
		return resolve(areasArr);
		});	
	});	
}

//consolidateFenceData("2017-07-10","2017-07-11","XD5756P");


function getMoveData(datetime1,datetime2,vehicle,company){
	var moveCount = 0;
	var sqlStmt = "SELECT DISTINCT id FROM node WHERE id NOT IN (SELECT node_id FROM fenced_node) AND datetime BETWEEN ? AND ? AND vehicle=? AND company=? AND speed>8 GROUP BY datetime";
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[datetime1,datetime2,vehicle,company],function (error, results, fields) {
			if(error){
				throw error;
			}
			if(results.length){
				//divide by 60 for hourly time,this is minutes
				moveCount = results.length;
			}
			if (error) reject(error);
			else resolve(moveCount);

		});
	});
}

function getStopData(datetime1,datetime2,vehicle,company){
	var stopCount = 0;
	var sqlStmt = "SELECT DISTINCT id FROM node WHERE id NOT IN (SELECT node_id FROM fenced_node) AND datetime BETWEEN ? AND ? AND vehicle=? AND company=? AND speed<=8  GROUP BY datetime";
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[datetime1,datetime2,vehicle,company],function (error, results, fields) {
			if(error){
				throw error;
			}
			if(results.length){
				//divide by 60 for hourly time
				stopCount = results.length;	
				if (error) reject(error);
				else resolve(stopCount);
			}

		});
	});
}

function getPlacement(datetime1,datetime2,vehicle){
	var placement = 0;
	var sqlStmt = "SELECT DISTINCT id FROM node WHERE datetime BETWEEN ? AND ? AND vehicle=? AND speed<=8  GROUP BY datetime LIMIT 20";
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[datetime1,datetime2,vehicle],function (error, results, fields) {
			if(error){
				throw error;
			}
			if(results.length){
				//divide by 60 for hourly time
				placement = results.length;	
				if (error) reject(error);
				else resolve(placement);
			}

		});
	});
}

function getTravelDistance(datetime1,datetime2,vehicle,company){
	var totalDist = 0;
	var q = "SELECT lat,lon FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND company=?";
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(q,[datetime1,datetime2,vehicle,company], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			for(var i=0;i<results.length;i++){
				var lat = results[i].lat;
				var lon = results[i].lon;
				if(i<results.length-1){
					var lat1 = results[i+1].lat;
					var lon1 = results[i+1].lon;
				}
				totalDist += haversineDistance(lat,lon,lat1,lon1,false);
			}
			if (error) reject(error);
			else resolve(totalDist);
		}
		});
	});
}


console.log("Haversine Dist: " + haversineDistance(1.304885,103.627607,1.306752,103.628305));

function getFirstDate(){
	var dataItem = [];
	connection.query('SELECT datetime,vehicle,company from node WHERE speed>0 ORDER BY id LIMIT 1', function (error, results, fields) {
		if(results.length>0){
			var dt = results[0].datetime;
			var veh = results[0].vehicle;
			var company = results[0].company;
			var dateStr = dt.substr(0,dt.indexOf(' '));
			var dateObj = Date.parse(dt);
			var utStart = Date.parse(dateObj).getTime()/1000;
			var tmrDate = new Date((utStart + 3600*24)*1000);
			var dateStrTmr = tmrDate.toString("yyyy-MM-dd");
			fixData(dateStr,dateStrTmr,veh,company);	
			wait(1500);
			fixDatav1(dateStr,dateStrTmr,veh,company);
			wait(1500);
			fixDatav2(dateStr,dateStrTmr,veh,company);
			/*fixDatav1(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("Check Inaccurate Data End : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));	
			removeGPSError(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("CHECK GPS Error : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));  
			removeLargeGaps(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("CHECK LARGE GAP : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));
			fixDatav2(dateStr,dateStrTmr,veh,company).then(function(counter) {
				//console.log(counter);
			}).catch((err) => setImmediate(() => { throw err; }));*/
			wait(1500);
			//removeDuplicateRows();
			getUtilTimeX(dateStr,dateStrTmr,veh,company).then(function(utilTimeX) {
				wait(1000);
				storeProcessedData(dateStr,veh,utilTimeX,company);
			}).catch((err) => setImmediate(() => { throw err; }));
			getTravelDistance(dateStr,dateStrTmr,veh,company).then(function(totalDist) {
				updateProcessedDataTravelDistance(totalDist,dateStr,veh);
			}).catch((err) => setImmediate(() => { throw err; }));
			getAllFenceIds(veh,dateStr,dateStrTmr,company).then(function(isDone){
				console.log("Is Done: " + isDone);
				if(isDone>0){
					getPlacement(dateStr,dateStrTmr,veh).then(function(placement){
						if(placement>0){
							wait(2000);
							getStopData(dateStr,dateStrTmr,veh,company).then(function(stopCount){
								if(stopCount>0){
									console.log("Stop Count: " + stopCount);
									wait(2000);
									updateProcessedDataStop(stopCount,dateStr,veh);	
									getMoveData(dateStr,dateStrTmr,veh,company).then(function(moveCount){
										if(moveCount>0){
											console.log("Move Count: " + moveCount);
											wait(2000);
											updateProcessedDataMove(moveCount,dateStr,veh);
											consolidateFenceData(dateStr,dateStrTmr,veh,company).then(function(results){
												if(results.length){
													storeProcessedAreas(dateStr,veh,results,company);
													var svcTime = results.reduce(getSum);
													updateProcessedDataService(svcTime,dateStr,veh);
													wait(2000);
													removeProcessedData(dateStr,dateStrTmr,veh);
													wait(2000);
													getFirstDate();
												}
											}).catch((err) => setImmediate(() => { throw err; }));
										}
									}).catch((err) => setImmediate(() => { throw err; }));
								}
							}).catch((err) => setImmediate(() => { throw err; }));	
						}	
					}).catch((err) => setImmediate(() => { throw err; }));
				}
			}).catch((err) => setImmediate(() => { throw err; }));
		}
	});
}

function getSum(total, num) {
    return total + num;
}


/* app.get('/setErrorMsg/:errorMsg', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		req.session.errMsg = req.params.errorMsg;
		errVerify= "done";
	}
		res.end();
});


app.get('/getErrorMsg', function (req, res) {
	var isDone = "done";
	req.session.errVerify = isDone;
	if(sess.company!=null){
		var company = sess.company;

		var currErrMsg = req.session.errMsg;
		var results = JSON.stringify(currErrMsg);
	}
		res.end(results);
}); */


//----NEW TEAM FUNCTIONS 09-01-10

app.get('/workTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`work_time`) AS work_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (plate_num=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/workTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`work_time`) AS work_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (plate_num=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/moveTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`move_time`) as move_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (plate_num= ? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/stopTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`unknown_stop`) AS unknown_stop FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (`plate_num`=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/serviceTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var teamVal = unescape(req.params.team);
		console.log(teamVal);
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`service_time`) AS service_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (`plate_num`=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/serviceAreasTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`service_time`) AS service_time,fence_type FROM processed_areas INNER JOIN vehicle ON processed_areas.vehicle = vehicle.plate_num WHERE (`plate_num`=? OR `team`=? OR processed_areas.company=?) AND processed_areas.date BETWEEN ? AND ? GROUP BY fence_type";
		var sqlQuery = connection.query(q, [req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

app.get('/travelDistanceTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var q = "";
		q = "SELECT AVG(`travel_distance`) AS travel_distance FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num WHERE (`plate_num`=? OR `team`=? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q,[req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			console.log(results[0].travel_distance);
			res.end(JSON.stringify(results));
		}
		});
		}else{
		res.redirect('/');
		}
});


app.get('/vehicleExpenditureTeam/team/:team/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var q = "";
		q = "SELECT AVG(`fuel_consumption`) AS fuel_consumption, AVG(`fuel_remaining`) AS fuel_remaining, AVG(`fuel_price`) AS fuel_price FROM vehicle WHERE `plate_num`=? OR `team`=? OR company=? ";
		var sqlQuery = connection.query(q,[req.params.team,req.params.team,req.params.team], function (error, results, fields) {
		if (error) throw error;
			if(results.length){
				//console.log(results[0]);
				res.end(JSON.stringify(results));
			}
		});
		}else{
		res.redirect('/');
		}
});




/* app.get('/utilFull/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var q = 'SELECT DISTINCT datetime,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
		var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,req.params.vehicle,speedMin,speedMax], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			var startTime = "";
			var endTime = "";
			for(var st=0;st<results.length;st++){
				if(results[st].speed > driverErrSpeed){
					startTime = results[st].datetime;
					break;
				}
			}
			
			for (var end=results.length-1;end>0;end--){
				if(results[end].speed > driverErrSpeed){
					endTime = results[end].datetime;
					break;
				}
			}
			
			var utStart = Date.parse(startTime).getTime()/1000;
			var utEnd = Date.parse(endTime).getTime()/1000;
			console.log("Start Time: " + utStart);
			console.log("End Time: " + utEnd);
			var hour = 3600;
			var fullDay = 3600*24;
			totalWorkingTime = (utEnd-utStart)/3600;
			//totalWorkingTime = (utEnd-utStart);
			console.log("Total Wk time? : " +totalWorkingTime);
		}
		res.end(JSON.stringify(totalWorkingTime));	
		});
	}else{
		res.redirect('/');
	}
}); */


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


app.get('/reset/:token', function(req, res) {
	var toDate = new Date(Date.now());
	sess = req.session;
	var resetToken = req.params.token;
	sess.token = resetToken;
	console.log("TESTTTTT");
	console.log(resetToken);
	var currentDateTime = toDate.toString("yyyy-MM-dd HH:mm:ss");
    connection.query('SELECT COUNT(*) AS valid FROM user where`reset_token`=? AND`token_expiry`>?', [req.params.token,currentDateTime], function (error, results, fields) {
	if (error){
		throw error;
	}
	if(results[0].valid != 0){
		var isValid = true;
		sess.valid = isValid
		res.redirect('/reset');
	}else{
		console.log()
		return res.redirect('/forgot');
	}
	});
});

app.post('/change', function(req, res) {
	var newPwd = req.body.password;
	var resetToken = sess.token;
	var toDate = new Date(Date.now());
	var currentDateTime = toDate.toString("yyyy-MM-dd HH:mm:ss");
	var salt = bcrypt.genSaltSync(saltRounds);
	var hash = bcrypt.hashSync(newPwd, salt);
    connection.query('UPDATE user SET `password`=?,`token_expiry`=? where`reset_token`=? AND`token_expiry`>?', [hash,currentDateTime,resetToken,currentDateTime], function (error, results, fields) {
	if (error){
		throw error;
	}
	resetToken = null;
	sess.token = null;
	return res.redirect('/');
	});
});

app.post('/uploadData', function (req, res) {
	errMsg = "";
	errType = "";
	if(sess.company!=null){
		var errorWrongFile = "Wrong File Type";
		var company = sess.company;
		var timestamp = Math.round(new Date().getTime()/1000);
		if(!req.files){
			res.render('pages/upload');
			return res.status(400).send('No files were uploaded.');
		}
		let sampleFile = req.files.file;
		var initialURL = '/home/safe/pmf/pmf-app/';
		var newAddr = 'tmp/' + timestamp + "_" + req.files.file.name ;
		var fileNameStr = "" + req.files.file.name ;
		//filename.split('.').pop();
		var fileExt = fileNameStr.split('.').pop();
		console.log(fileExt);
		if(fileExt!== "xlsx"){
			console.log("In checkExt");
			errMsg = "File type error";
			errType = "X";
			res.redirect("/upload");
			res.finished = true;
			return;
		}
		var fullURL = initialURL + newAddr;
		sampleFile.mv(fullURL, function(err) {
			if (err){
				console.log("Err sampleFile");
				 res.render('pages/upload');
				return res.status(500).send(err);
			}else{
				try{
					var workbook = XLSX.readFile(newAddr,{sheetStubs:true});
					var worksheet = workbook.Sheets[workbook.SheetNames[0]];
					var checkCellA1 = worksheet.A1;
					var checkCellA2 = worksheet.A2;
					if(checkCellA1 === undefined || checkCellA2 === undefined){
						console.log("In checkExt");
						errMsg = "Incorrect file uploaded";
						errType = "X";
						res.redirect("/upload");
						res.finished = true;
						return;
					}
					var cellCompanyFN = worksheet['A1'];
					var cellVehicle = worksheet['A2'];
					var vehicleCelVal = cellVehicle.v;
					console.log("Date FMT: " + worksheet['A8'].v);
					var dateChk = "" + worksheet['A8'].v;
					if(dateChk.indexOf("/")<0){
						console.log("Date check");
						errType = "X";
						errMsg = "Incorrect Date Format in File - Editing of Date is not allowed";
						res.redirect("/upload");
						res.finished = true;
						return;
					}
 					var vehicleWord = vehicleCelVal.substr(0,7); 
					console.log("Vehicle Word: " + vehicleWord);
					if(vehicleWord !== 'vehicle'){
						console.log("Vehicle word check");
						errType = "X";
						errMsg = "Incorrect File Uploaded";
						res.redirect("/upload");
						res.finished = true;
					}
					var cellStartDate = worksheet['A3'];
					var cellEndDate = worksheet['A4'];
					var vehicleNum = vehicleCelVal.substr(9,vehicleCelVal.length-1);
					cellVehicle.v = "";
					cellCompanyFN.v = "";
					cellStartDate.v = "";
					cellEndDate.v = "";
					console.log(vehicleNum);
					var cellDate = worksheet['A6'];
					cellDate.v = "datetime";
					var cellLat = worksheet['B6'];
					cellLat.v = "lat";
					var cellLon = worksheet['C6'];
					cellLon.v = "lon";
					var cellRoad = worksheet['D6'];
					cellRoad.v = "roadname";
					var cellSpeed = worksheet['E6'];
					cellSpeed.v = "speed";
					var startDateVal = cellStartDate.h;
					var endDateVal = cellEndDate.h;
					var startDateArr = startDateVal.trim().split(" ");
					var endDateArr = endDateVal.trim().split(" ");;
					var startDateStr = startDateArr[2].trim();
					var endDateStr = endDateArr[2].trim();
					var startDate = startDateStr.split("/").reverse().join("-");
					var endDate = endDateStr.split("/").reverse().join("-");
					var fmt = 'YYYY-MM-DD hh:mm';
						XLSX.writeFile(workbook,newAddr);
						XLSX.utils.sheet_to_csv(worksheet);
						var workbook = XLSX.readFile(newAddr);
						var worksheet = workbook.Sheets[workbook.SheetNames[0]];
						var output_file_name ="tmp/hpd_" + timestamp + ".csv";
						var stream = XLSX.stream.to_csv(worksheet);
							stream.pipe(fs.createWriteStream(output_file_name)).on('finish', function () {
								console.log("Inserting data into database");
								var comma = ",";
								var enclose = '\'';
								var escape = '\\';
								var terminator = '\n';
								console.log("Start Date:" + startDate);
								console.log("End Date:" + endDate);
								checkDataReplication(startDate,endDate,vehicleNum,company,output_file_name).then(function(total,outputFileName) {
								console.log("TOTAL! + " + total);
								if(total<1){
									var query = connection.query('LOAD DATA LOCAL INFILE ' + "'" + output_file_name + "'" + ' INTO TABLE `node` FIELDS TERMINATED BY ? ENCLOSED BY ? ESCAPED BY ? LINES TERMINATED BY ? IGNORE 6 LINES (@datetime, @lat, @lon, @roadname, @speed) SET `datetime` = STR_TO_DATE(@datetime,?),lat=@lat,lon=@lon,roadname=@roadname,speed=@speed,vehicle=?,company=?',[comma,enclose,escape,terminator,'%d/%m/%Y %H:%i',vehicleNum,company],function (error, results, fields) {
										if (error){
											errMsg = "Errors with data format";
											errType = "X";
											res.redirect("/upload");
											res.finished = true;
											return;
										}else{
											errType = "0";
											errMsg = "Successfully uploaded data";
											updateVehicleData(vehicleNum,company);
											var successStr = JSON.stringify(results[0]);
											console.log("Session Err value = " +errMsg);
											res.redirect("/upload");
											res.finished = true;
											return;
										}
										//res.end();
										//res.end(JSON.stringify(results));
									}); 						
								}else{
									errMsg = "This data already exists";
									errType = "X";
									res.redirect("/upload");
									res.finished = true;
									return;
								}
 								/*DEL(['tmp/*'], function (err, paths) {
									console.log('Deleted files/folders:\n', paths.join('\n'));
								});	 */		
							});
					});
					
				}catch(error){
						//res.json({ message: error.message });
					
				}
			}
		});
		//res.end(JSON.stringify(results));
	}else{
		res.redirect('/');
	}
});


//rest api to get all results
app.get('/node', function (req, res) {
	connection.query('select * from node', function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});

app.get('/polygon/:id', function (req, res) {
	connection.query('select * from fence where id=?',[req.params.id], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});
//rest api to get a single node data
app.get('/node/:id', function (req, res) {
	console.log(req);
	connection.query('select * from node where id=?', [req.params.id], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});

//rest api to get a all fence data
app.get('/fence', function (req, res) {
	console.log(req);
	connection.query('select * from fence', function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});


//rest api to get the specific vehicle that is idling for a specific day
app.get('/node/vehicle/:vehicle/datetime/:datetime/speed/:speed', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		connection.query('select COUNT (*) AS idleCount from node where vehicle=? AND datetime<? AND speed<? AND company=?', [req.params.vehicle,req.params.datetime,req.params.speed,company], function (error, results, fields) {
			if (error) throw error;
			res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

app.get('/vehicleProfile/vehicle/:vehicle', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		connection.query('select fuel_consumption,fuel_price,fuel_remaining,tyre_wear FROM vehicle WHERE company=? AND plate_num=?',[company,req.params.vehicle] ,function (error, results, fields) {
		if (error) throw error;
		console.log(JSON.stringify(results));
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});


app.get('/stationary/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/', function (req, res) {
	if(sess.company!=null){
		var nodeArr = [];
		var company = sess.company;
		var speedMin = 0;
		var speedMax = 8;
		//var speed = req.params.speed;
		var symbol = req.params.symbol;
		var q = 'SELECT COUNT(DISTINCT datetime) AS stationaryTime FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
		var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,req.params.vehicle,speedMin,speedMax], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			var stationaryTime = (results[0].stationaryTime)/60;	
		}
		res.end(JSON.stringify(stationaryTime));
		});
		//console.log(sqlQuery.sql);
	}else{
		res.redirect('/');
	}
});

var teamStationaryArr = [];
app.get('/stationary/dateStart/:dateStart/dateEnd/:dateEnd/team/:vehicles/', function (req, res) {
	if(sess.company!=null){
		var nodeArr = [];
		var teamArr = [];
		var company = sess.company;
		var speedMin = 0;
		var speedMax = 8;
		//var speed = req.params.speed;
		teamArr = req.params.vehicles.split(',');
		for(var i=0;i<teamArr.length;i++){
			var vehicleNum = teamArr[i];
			var q = 'SELECT COUNT(DISTINCT datetime) AS stationaryTime FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
			var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,vehicleNum,speedMin,speedMax], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				var stationaryTime = (results[0].stationaryTime)/60;
				console.log("Stationary time: " + stationaryTime);
				teamStationaryArr.push(stationaryTime);
			}
			//res.end(JSON.stringify(stationaryTime));
			});
		}
		if(teamStationaryArr.length>0){
			
			res.end(JSON.stringify(teamStationaryArr));
		}
		//console.log(sqlQuery.sql);
	}else{
		res.redirect('/');
	}
	teamStationaryArr = [];
});

//show vehicles in a team
app.get('/vehiclesInTeam/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var noTeam = "";
		connection.query('select id,plate_num,team from vehicle WHERE `company`=? AND `team`<>? GROUP BY plate_num',[company,noTeam] ,function (error, results, fields) {
		if (error) throw error;
		console.log(JSON.stringify(results));
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});
/* 
app.get('/vehiclesNotInTeam/', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var noTeam = "";
		connection.query('select plate_num,team from vehicle WHERE company=? and team=?',[company,noTeam] ,function (error, results, fields) {
		if (error) throw error;
		console.log(JSON.stringify(results));
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

//clone team version of Util Rate method
//global variable to get data out of this mess
var resultVals = [];
app.get('/utilFull/dateStart/:dateStart/dateEnd/:dateEnd/team/:vehicles/', function (req, res) {
	if(sess.company!=null){
		var nodeArr = [];
		var teamArr =[];
		var totalWTCombined = 0;
		var company = sess.company;
		var speedMin = 0;
		var speedMax = 90;
		var totalWorkingTime = 0;
		var driverErrSpeed = 5;
		teamArr = req.params.vehicles.split(',');
		for(var i=0;i<teamArr.length;i++){
			var vehicleNum = teamArr[i];
			var q = 'SELECT DISTINCT datetime,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
			var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,vehicleNum,speedMin,speedMax], function (error, results, fields) {
			if (error) throw error;
				if(results.length){
					var startTime = "";
					var endTime = "";
					for(var st=0;st<results.length;st++){
						if(results[st].speed > driverErrSpeed){
							startTime = results[st].datetime;
							break;
						}
					}
					for (var end=results.length-1;end>0;end--){
						if(results[end].speed > driverErrSpeed){
							endTime = results[end].datetime;
							break;
						}
					}	
					var utStart = Date.parse(startTime).getTime()/1000;
					var utEnd = Date.parse(endTime).getTime()/1000;
					var hour = 3600;
					var fullDay = 3600*24;
					totalWorkingTime = (utEnd-utStart)/3600;
					//totalWorkingTime = (utEnd-utStart);
					totalWTCombined += totalWorkingTime;
					resultVals.push(totalWTCombined);
					//console.log("Total WTCombined time? : " +totalWTCombined);	
				}
			});
		}
		if(resultVals.length>0){
			res.end(JSON.stringify(resultVals));
		}
	}else{
		res.redirect('/');
	}
	resultVals = [];
}); */

/* var utilFullMoveArr = [];
app.get('/utilFullMove/dateStart/:dateStart/dateEnd/:dateEnd/team/:vehicles/', function (req, res) {
	if(sess.company!=null){
		var nodeArr = [];
		var teamArr =[];
		var totalWTCombined = 0;
		var company = sess.company;
		var speedMin = 0;
		var speedMax = 90;
		var totalWorkingTime = 0;
		var driverErrSpeed = 5;
		teamArr = req.params.vehicles.split(',');
		for(var i=0;i<teamArr.length;i++){
			var vehicleNum = teamArr[i];
			var q = 'SELECT DISTINCT datetime,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
			var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,vehicleNum,speedMin,speedMax], function (error, results, fields) {
			if (error) throw error;
				if(results.length){
					var startTime = "";
					var endTime = "";
					for(var st=0;st<results.length;st++){
						if(results[st].speed > driverErrSpeed){
							startTime = results[st].datetime;
							break;
						}
					}
					for (var end=results.length-1;end>0;end--){
						if(results[end].speed > driverErrSpeed){
							endTime = results[end].datetime;
							break;
						}
					}	
					var utStart = Date.parse(startTime).getTime()/1000;
					var utEnd = Date.parse(endTime).getTime()/1000;
					var hour = 3600;
					var fullDay = 3600*24;
					totalWorkingTime = (utEnd-utStart)/3600;
					//totalWorkingTime = (utEnd-utStart);
					totalWTCombined += totalWorkingTime;
					utilFullMoveArr.push(totalWTCombined);
					//console.log("Total WTCombined time? : " +totalWTCombined);	
				}
			});
		}
		if(utilFullMoveArr.length>0){
			res.end(JSON.stringify(utilFullMoveArr));
		}
	}else{
		res.redirect('/');
	}
	utilFullMoveArr = [];
});

app.get('/utilFull/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/', function (req, res) {
	if(sess.company!=null){
		var nodeArr = [];
		var company = sess.company;
		var speedMin = 0;
		var speedMax = 90;
		var totalWorkingTime = 0;
		var driverErrSpeed = 5;
		var symbol = req.params.symbol;
		var q = 'SELECT DISTINCT datetime,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND company=? AND vehicle=? AND speed BETWEEN ? and ?';
		var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,req.params.vehicle,speedMin,speedMax], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			var startTime = "";
			var endTime = "";
			for(var st=0;st<results.length;st++){
				if(results[st].speed > driverErrSpeed){
					startTime = results[st].datetime;
					break;
				}
			}
			
			for (var end=results.length-1;end>0;end--){
				if(results[end].speed > driverErrSpeed){
					endTime = results[end].datetime;
					break;
				}
			}
			
			var utStart = Date.parse(startTime).getTime()/1000;
			var utEnd = Date.parse(endTime).getTime()/1000;
			console.log("Start Time: " + utStart);
			console.log("End Time: " + utEnd);
			var hour = 3600;
			var fullDay = 3600*24;
			totalWorkingTime = (utEnd-utStart)/3600;
			//totalWorkingTime = (utEnd-utStart);
			console.log("Total Wk time? : " +totalWorkingTime);
		}
		res.end(JSON.stringify(totalWorkingTime));	
		});
	}else{
		res.redirect('/');
	}
});
app.get('/distance/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/', function (req, res) {
	if(sess.company!=null){
		var urlArr = [];
		var company = sess.company;
		var speed = 7;
		var test = "";
		var urlArr = [];
		//console.log("Greetings from Earth");
		var q = 'SELECT lat,lon FROM `node` WHERE datetime BETWEEN ? and ? AND `company`=? AND vehicle=? AND speed > ? GROUP BY datetime';
		var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,company,req.params.vehicle,speed], function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			var resultsArr = results;
			for(var i=0;i<resultsArr.length;i++){
				var lat= resultsArr[i].lat;
				var lon= resultsArr[i].lon;
				var nextLat = i<resultsArr.length-1 ? resultsArr[i+1].lat : resultsArr[i].lat;
				var nextLon = i<resultsArr.length-1 ? resultsArr[i+1].lon : resultsArr[i].lon;
				if(lat==nextLat && lon==nextLon){
					continue;
				}
				var routeURL = 'http://dev.logistics.lol:5000/viaroute?loc=' + lat + "," + lon +'&loc=' + nextLat + "," + nextLon;
				urlArr.push(routeURL);
			}
		}
		res.end(JSON.stringify(urlArr));	
		});
	}else{
		res.redirect('/');
	}
});


app.get('/types/:type', function (req, res) {
	if(sess.company!=null){
		var items = [];
		var areaLoc= "TM";
		var q = 'SELECT id from fence where type=?';
		var sqlQuery = connection.query(q, [req.params.type], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(totalTimeInFence));
		});
		//console.log(sqlQuery.sql);
	}else{
		res.redirect('/');
	}
}); */

app.get('/fenceTypes', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var fenceAll = "ALL"
		var q = "SELECT id,type from fence where company=? OR company=?";
		var sqlQuery = connection.query(q, [fenceAll,company], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
			}
			res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

function compareIds(a, b) {
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

//TO-DO Auto run data fix
/* function runFix(){
	var vehs = getNodeVehicles();
	for(var i=0;i<vehs.length;i++){
		var vehicleNum = vehs[i].plate_num;
		var sqlStmt= 'SELECT * from node where vehicle=' + vehicleNum + '" ORDER BY datetime ASC';
		connection.query(sqlStmt, function (error, results, fields) {
			
		});
			
			
		
	} 
}
*/

//This fixes the data for 0 speeds at the start of the data
function fixData(dateStart,dateEnd,vehicleNum,company){
	var sqlStmt= 'SELECT id,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=?';
	var q = 'DELETE FROM node where `id`<=? AND `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=? ';
	var sqlQuery = connection.query(sqlStmt,[dateStart,dateEnd,vehicleNum,company], function (error, results, fields) {
		if(results.length){
			for(var i=0;i<results.length;i++){
				var referenceNode = results[i];
				var speedVal = referenceNode.speed;
				var nodeID = referenceNode.id;
				if(speedVal<=0){
					var sqlQuery2 = connection.query(q,[nodeID,dateStart,dateEnd,vehicleNum,company], function (error, results, fields) {
					if (error) throw error;
						if(results.length){
						}
					});
				}
			}
		}
	});
}

//This fixes the data for 0 speeds at the end of the data
function fixDatav1(dateStart,dateEnd,vehicleNum,company){
	var isDone = 0;
	var sqlStmt= 'SELECT id,speed FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=?';
	var q = 'DELETE FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=? AND `id`>=?';
	//return new Promise(function(resolve, reject) {
	var sqlQuery = connection.query(sqlStmt,[dateStart,dateEnd,vehicleNum,company], function (error, results, fields) {
		if(results.length){
			for(var i=results.length-1;i>0;i--){
				var referenceNode = results[i];
				var speedVal = referenceNode.speed;
				var nodeID = referenceNode.id;
				if(speedVal<=0){
					var sqlQuery2 = connection.query(q,[dateStart,dateEnd,vehicleNum,company,nodeID], function (error, results, fields) {
					if (error) throw error;
						if(results.length){
						}
					});
				}
			}
		}
/* 		if(error){
			reject(error);
		}
			resolve(results); */

	});
	//});
}


//fixes the data for missing time periods and adds new coordinates to link the points
var counter= 0;
function fixDatav2(startDate,endDate,vehicleNum,company){
	var sd = startDate;
	var ed = endDate;
	var vhNum = vehicleNum;
	var count = 0;
	var fixDate = "";
	var tempArr = [];
	var isComplete = false;
	var dateDiffMinus = 0;
	var sqlStmt= 'SELECT * from node where `datetime` BETWEEN ? AND ?  AND vehicle=? AND company=? ORDER BY id ASC';
	//return new Promise(function(resolve, reject) {
	//console.log(sqlStmt);
	connection.query(sqlStmt,[startDate,endDate,vehicleNum,company],function (error, results, fields) {
		if (error) throw error;
		if(results.length){
			var company = results[0].company;
			var referenceNode = results[0];
			var tempNode = results[0];
			for(var i=0;i<results.length;i++){
				var referenceDatetime = referenceNode.datetime;
				var iterNode = results[i];
				var firstDateTime = iterNode.datetime;
					var d1 = new Date(referenceDatetime)/1000;
					var d2 = new Date(firstDateTime)/1000;
					var dateDiff = (d2-d1)/60;
					if(dateDiff<=1){
						referenceNode = iterNode;	
						continue;
					}
					//console.log("DateDiff = " + dateDiff + "- Reference Datetime: " + referenceDatetime + "- FirstDateTime: " + firstDateTime );
					if(dateDiff>1){
						for(var x=1;x<=dateDiff;x++){
							dateDiffMinus = dateDiff-1;
							var dateConvert = new Date(referenceDatetime)/1000;
								fixDate = new Date(dateConvert).getTime()+ (60*x);
								var epochDate = fixDate * 1000;
								var toDate = new Date(epochDate);
								var dbFmtDate = toDate.toString("yyyy-MM-dd HH:mm:ss");
								tempNode.datetime = dbFmtDate;
								var pcnt = parseFloat(1/dateDiff)*x;
								//interpolation of coordinates
								var latitude = parseFloat(referenceNode.lat+ (iterNode.lat - referenceNode.lat) * pcnt).toFixed(9);
								var longitude = parseFloat(referenceNode.lon + (iterNode.lon - referenceNode.lon) * pcnt).toFixed(8);
								var stLineDist = myDistance(referenceNode.lat,referenceNode.lon,iterNode.lat,iterNode.lon);
								/* console.log("--------------");
								console.log("New Date: " + dbFmtDate);
								console.log("Reference node coords: " +referenceNode.lat + " - " + referenceNode.lon);
								console.log("Iter node coords: " +iterNode.lat + " - " + iterNode.lon);
								console.log("Extrapolated node coords: " + latitude+ " - " + longitude);
								console.log("Percent Value: "+pcnt); */
								//interpolation of speed
								//SELECT * FROM `nodev2` WHERE `datetime` BETWEEN "2017-07-07 08:39" AND "2017-07-07 09:34"
								var newSpeed = parseFloat(stLineDist/(dateDiff/60)).toFixed(2);
								//console.log("Lat: " + latitude + "," + " Lon: " + longitude + "," + "StLine Dist: " +stLineDist);
								//console.log(newSpeed);
								if(newSpeed<1){
									tempNode.speed = 1;
								}else{
									tempNode.speed = Math.round(newSpeed);
								}
								if(x<=dateDiffMinus){
									connection.query('INSERT INTO `node` SET `datetime`=?,`vehicle`=?,`company`=? ,`lat`=?,`lon`=?,`roadname`=?,`speed`=?',[tempNode.datetime,tempNode.vehicle,tempNode.company,latitude,longitude,tempNode.roadname,tempNode.speed], function (error, results, fields) {
										if (error) throw error;
										//counter++;
									});
								}
							}
						referenceNode = iterNode;
					}
					
					
			}
			counter = 99;
		}
/*  		if(error){
			reject(error);
		}
		resolve(results);
		}); */
	
	});

}

//fixDatav2("2017-07-10","2017-07-11","XD5756P");

//This method is to find the points along a straight line between two points
/* function intermPoint(lat1, lon1, lat2, lon2, per) {
	var latitude = parseFloat(lat1 + (lat2 - lat1) * per);
	var longitude = parseFloat(lon1 + (lon2 - lon1) * per);
	console.log("INTERMLAT: " + latitude);
	console.log("INTERMLON: " + longitude);	
    return [latitude.toFixed(9),longitude.toFixed(7)];
} */


function getAllFenceIds(vehicle,datetime1,datetime2,company){
	var plateNum = vehicle;
	var fenceIDs = [];
	var sqlStmt = "SELECT * FROM `fence` WHERE `company` IN ('ALL') OR `company`=?";
	var sqlStmt2 ='SELECT *,? AS fenceID,? AS fenceType FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND st_contains((select polygonTest from fence where id=?), POINT(`lon`,`lat`)) GROUP BY datetime ORDER BY `datetime` ASC;';
	var sqlStmt3 = 'INSERT INTO fenced_node SET `datetime`=?,`vehicle`=?,`company`=?,`lat`=?,`lon`=?,`roadname`=?,`speed`=?,`node_id`=?,`fenceID`=?,`fence_type`=?';
	var fenceId = 0;
	var isDone = 0;
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[company],function (error, results, fields) {
			if (error)throw error;
			if(results.length){
				for(var i=0;i<results.length;i++){
					var type = "";
					fenceId = results[i].id;
					var type = results[i].type;
			
					var sqlQuery2 = connection.query(sqlStmt2,[fenceId,type,datetime1,datetime2,vehicle,fenceId], function (error, results2, fields) {
						if (error) throw error;
						if(results2.length){
							for(var j=0;j<results2.length;j++){
								var node = results2[j];
								var sqlQuery3 = connection.query(sqlStmt3,[node.datetime,node.vehicle,node.company,node.lat,node.lon,node.roadname,node.speed,node.id,node.fenceID,node.fenceType], function (error, results2, fields) {
									if (error) throw error;
								});
							}
						//console.log(results.length + " - "+ fenceId);	
						}
					});
					
				}
				isDone = 1;
					
			}
			if (error) reject(error);
					else resolve(isDone);

		});
	});
	
}


/*
app.get('/locations/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/arrData/:arrData', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var myJSON = "";
		var totalTimeArr = [];
		var paramsArr = [];
		var fenceCompany = [];
		var fenceDepot = [];
		var fencePort = [];
		var fenceWarehouse = [];
		var fenceUnknown = [];
		var csvArr = [];
		var jitterDPArr = [];
		var moveDPArr = [];
		var stopDPArr = [];
		var fenceData = JSON.parse(req.params.arrData);	
		var queryCount = 0;
		var sqlStmt = "";
		if(fenceData.length){
			for(var i=0;i<fenceData.length;i++){
				var fenceId = fenceData[i].id;
				var fenceType = fenceData[i].type;
				queryCount = i+1;
				sqlStmt += 'SELECT * FROM nodev2 WHERE `datetime` BETWEEN "'+ req.params.dateStart + '" AND "' + req.params.dateEnd + '" AND company= "' + company + '" AND vehicle= "' + req.params.vehicle + '" AND st_contains((select polygonTest from fence where id=' + fenceId + '), POINT(`lon`,`lat`)) GROUP BY datetime ORDER BY `datetime` ASC;';
			}
		}
		var sqlQuery = connection.query(sqlStmt, paramsArr, function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				for(var k=0;k<queryCount;k++){
					var jitterDPArr = [];
					var moveDPArr = [];
					var stopDPArr = [];
					var fenceType = fenceData[k].type;
					var fenceID = fenceData[k].id;
					
					var totalTimeInFence = 0;
					if(results[k]){
						var resultArr = results[k];
						for(var i=0;i<resultArr.length;i++){
							var startTime = resultArr[i].datetime;
							var speedData = resultArr[i].speed;
							if(fenceType =='TM')
						    if(speedData>=1  && speedData<8 && fenceType=='TM'){
								var jitterStr = resultArr[i].lat + "," + resultArr[i].lon +"," + resultArr[i].datetime +"," + "J";
								csvArr.push(jitterStr);
							}else if(speedData ==0 && fenceType=='TM'){
								var stopStr = resultArr[i].lat + "," + resultArr[i].lon +"," + resultArr[i].datetime +"," + "S";
								csvArr.push(stopStr);	
							}else if (fenceType=='TM'){
								var moveStr = resultArr[i].lat + "," + resultArr[i].lon +"," + resultArr[i].datetime +"," + "M";
								csvArr.push(moveStr);
							} */
							/* var nextTime = i<resultArr.length-1 ? resultArr[i+1].datetime : resultArr[i].datetime;
							var utStart = Date.parse(startTime).getTime()/1000;
							var utNext = Date.parse(nextTime).getTime()/1000;
							if((utNext-utStart)<=3600){
								totalTimeInFence+=(utNext-utStart)/3600;
								
							}else{
								totalTimeArr.push(totalTimeInFence);
								totalTimeInFence = 0;	
							} 
						}
						console.log("--Fence ID--: " + fenceID);
						console.log("TotalTimeInFence: " + totalTimeInFence);
						var uniqueArrayJitter = jitterDPArr.filter(function(elem, pos) {
							return jitterDPArr.indexOf(elem) == pos;
						});
						//console.log("JitterArr," + uniqueArrayJitter);
						var uniqueArrayMove = moveDPArr.filter(function(elem, pos) {
							return moveDPArr.indexOf(elem) == pos;
						});
						//console.log("MoveArr," + uniqueArrayMove);
						var uniqueArrayStop= stopDPArr.filter(function(elem, pos) {
							return stopDPArr.indexOf(elem) == pos;
						});
						//console.log("StopArrPort," + uniqueArrayStop);
						//console.log(csvArr);	
						csvArr = [];
						
						console.log("---------END FENCE--------");
						if(fenceType=="HQ"){
							fenceCompany.push(totalTimeInFence);
						}else if(fenceType=='DP'){
							fenceDepot.push(totalTimeInFence);
						}else if(fenceType=='WH'){
							fenceWarehouse.push(totalTimeInFence);
						}else if(fenceType=='TM'){
							fencePort.push(totalTimeInFence);
						}else{
							fenceUnknown.push(totalTimeInFence);
						}	
					}
				}
				if(!fenceCompany.length){
					fenceCompany[0] = 0;
				}
				if(!fenceWarehouse.length){
					fenceWarehouse[0] =0;
				}
				if(!fenceDepot.length){
					fenceDepot[0]=0;
				}
				if(!fencePort.length){
					fencePort[0] = 0;
				}
				var obj = {"HQ":fenceCompany[0], "WH":fenceWarehouse[0],"DP":fenceDepot[0],"TM":fencePort[0]};
				myJSON = JSON.stringify(obj);
				//console.log(myJSON);
				res.end(myJSON);
			}
		}
		});
			//console.log(sqlQuery.sql);
		//}
	}else{
		res.redirect('/');
	}
});*/
//team mutltiple fenced locations method
/* 
app.get('/locations/dateStart/:dateStart/dateEnd/:dateEnd/team/:vehicles/arrData/:arrData', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		var myJSON = "";
		var paramsArr = [];
		var fenceCompany = [];
		var fenceDepot = [];
		var fencePort = [];
		var fenceWarehouse = [];
		var fenceUnknown = [];
		var fenceData = JSON.parse(req.params.arrData);	
		var queryCount = 0;
		var sqlStmt = "";
		if(fenceData.length){
			for(var i=0;i<fenceData.length;i++){
				var fenceId = fenceData[i].id;
				var fenceType = fenceData[i].type;
				queryCount = i;
				var fenceType = fenceData[i].type;
				sqlStmt += 'SELECT DISTINCT datetime FROM node WHERE `datetime` BETWEEN "'+ req.params.dateStart + '" AND "' + req.params.dateEnd + '" AND company= "' + company + '" AND vehicle= "' + req.params.vehicle + '" AND st_contains((select polygonTest from fence where id=' + fenceId + '), POINT(`lon`,`lat`)) ORDER BY `datetime` ASC;';
			}
		}
			var sqlQuery = connection.query(sqlStmt, paramsArr, function (error, results, fields) {
				if (error) throw error;
				if(results.length){
					for(var k=0;k<queryCount;k++){
						var fenceType = fenceData[k].type;
						var totalTimeInFence = 0;
						if(results[k]){
							var resultArr = results[k];
							for(var i=0;i<resultArr.length;i++){
								var startTime = resultArr[i].datetime;
								var nextTime = i<resultArr.length-1 ? resultArr[i+1].datetime : resultArr[i].datetime;
								var utStart = Date.parse(startTime).getTime()/1000;
								var utNext = Date.parse(nextTime).getTime()/1000;
								if((utNext-utStart)<=3600){
									totalTimeInFence+=(utNext-utStart)/3600;
								}
							}
							if(fenceType=="HQ"){
								fenceCompany.push(totalTimeInFence);
							}else if(fenceType=='DP'){
								fenceDepot.push(totalTimeInFence);
							}else if(fenceType=='WH'){
								fenceWarehouse.push(totalTimeInFence);
							}else if(fenceType=='TM'){
								fencePort.push(totalTimeInFence);
							}else{
								fenceUnknown.push(totalTimeInFence);
							}	
						}
					}
					if(!fenceCompany.length){
						fenceCompany[0] = 0;
					}
					if(!fenceWarehouse.length){
						fenceWarehouse[0] =0;
					}
					if(!fenceDepot.length){
						fenceDepot[0]=0;
					}
					if(!fencePort.length){
						fencePort[0] = 0;
					}
					var obj = {"HQ":fenceCompany[0], "WH":fenceWarehouse[0],"DP":fenceDepot[0],"TM":fencePort[0]};
					myJSON = JSON.stringify(obj);
					//console.log(myJSON);
					res.end(myJSON);
				}
			});
			//console.log(sqlQuery.sql);
		//}
	}else{
		res.redirect('/');
	}
}); */

app.get('/vehicles/', function (req, res) {
	if(sess.company!=null){
		var coy = sess.company;
		connection.query('SELECT DISTINCT plate_num FROM vehicle WHERE company=?',[coy], function (error, results, fields) {
			if (error) throw error;
			res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

app.get('/teams/', function (req, res) {
	if(sess.company!=null){
		var coy = sess.company;
		console.log(coy);
		connection.query('SELECT DISTINCT team FROM vehicle where company=?',[coy], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

//OLD rest api to get the SPECIFIC LOCATION OF A vehicle that is idling for a specific day
/* app.get('/node/distance/loc/:lat1/:lon1/datetime/:datetime', function (req, res) {
	if(sess.company!=null){
		var company = sess.company;
		connection.query('SELECT COUNT (*) AS fenceCount from node where calc_distance(lat,lon,?,?) < 0.4 AND datetime<? AND company=?',[req.params.lat1,req.params.lon1,req.params.datetime,company], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
}); */



function updateVehicleData(vehicleNum,company){
	var vehiclePlateNum = vehicleNum.substr(0,7);
	connection.query('INSERT INTO vehicle (plate_num,company) SELECT * FROM (SELECT ?,?) AS tmp WHERE NOT EXISTS (SELECT plate_num,company FROM vehicle WHERE plate_num=? AND company=?) LIMIT 1',[vehiclePlateNum,company,vehiclePlateNum,company], function (error, results, fields) {
		if (error) throw error;
	});	
}


///Gets vehicles from the newly uploaded data 15-01
function getNodeVehicles(){
	var vehicleNodeData = "";
	connection.query('SELECT DISTINCT vehicle,company FROM node', function (error, results, fields) {
		if (error) throw error;
		vehicleNodeData = results;
		getVehicleVehicles(vehicleNodeData);
	});
	
}

function getVehicleVehicles(vehicleNodeData){
	var vehicleData = "";
	connection.query('SELECT DISTINCT plate_num,company FROM vehicle', function (error, results, fields) {
		if (error) throw error;
		vehicleData = results;
		checkVehicles(vehicleNodeData,vehicleData);
	});
	
}

function checkVehicles(vehicleNodeData,vehicleData){
	var nonDuplicateVehs = [];
	var dupVehs = [];
	
	for(var i=0;i<vehicleData.length;i++){
		var veh = vehicleData[i].plate_num;
		for(var j=0;j<vehicleNodeData.length;j++){
			var nodeVeh = vehicleNodeData[j].vehicle;
			if(nodeVeh == veh){
				vehicleNodeData.splice(j,1);
			}
		}
	} 
	nonDuplicateVehs = vehicleNodeData;
	putVehiclesInDb(nonDuplicateVehs);	
	
}

function putVehiclesInDb(nonDuplicateVehs){
	for(var i=0;i<nonDuplicateVehs.length;i++){	
		var company = nonDuplicateVehs[i].company;
		var vehicleNum = nonDuplicateVehs[i].vehicle;
		connection.query('INSERT INTO vehicle SET `plate_num`=?,`company`=?',[vehicleNum,company], function (error, results, fields) {
			if (error) throw error;
		});
	}
}

//rest api to create a new record into mysql database
app.post('/node', function (req, res) {
	var postData  = req.body;
	connection.query('INSERT INTO node SET ?', postData, function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});

//Rest API to create a new user
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

//Rest API to verify a user
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
				sess = req.session;
				sess.username = username;
				sess.company = company;
				res.redirect('/col');
			}else{
				res.redirect('/');  
			}
		}else{
			res.redirect('/');
		}
	}); 
});

//Rest API to create a new Fence with the given text and gemoetric data 
app.post('/fenceData', function (req, res) {
	var coy = "-";
	if(sess.company!=null){
		coy = sess.company;
	}
	areaName = req.body.areaName;
	areaAddr = req.body.areaAddr;
	areaPostal = req.body.areaPostal;
	areaType = req.body.areaType;
	poly = req.body.poly;
	console.log("POLY: " + poly);
	var tempVar = poly.split(',').join(" ");
	var polyShape = tempVar.split("-").join(",");
	var polyArr = [];
	var coordArr = [];
	
	connection.query('INSERT INTO fence SET `name`=?,`address`=?,`postal`=?, `type`=?,`lat`=?,`lon`=?,`company`=?,`polygonTest`=PolygonFromText(?)', [areaName,areaAddr,areaPostal,areaType,0,0,coy,"POLYGON((" + polyShape +"))"], function (error, results, fields) {
		if (error) throw error;
		req.flash('success', 'Demarcation of area successful');
		res.redirect('/col');
	});
});

app.post('/teamAssign', function (req, res) {
	var coy = "-";
	var removeTeam = "";
	if(sess.company!=null){
		coy = sess.company;
	}
	var teamName = req.body.teamName;
	var vehicleData = req.body.teamVehData;
	console.log("TEAM NAME: " + teamName);
	var vehicles = chunkSubstr(vehicleData,7);
	for(var x=0;x<vehicles.length;x++){
		var vehicle = vehicles[x];
		console.log("Vehicle " + x + ":" + vehicle);
		connection.query('UPDATE vehicle SET `team`=? WHERE plate_num=? AND company=?', [teamName,vehicle,coy], function (error, results, fields) {
				if (error) throw error;
				res.end(JSON.stringify(results));
		});  
	}
	res.redirect('/profile');
});

function chunkSubstr(str, size) {
	const numChunks = Math.ceil(str.length / size);
	const chunks = new Array(numChunks);

	for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
		chunks[i] = str.substr(o, size);
	}
	return chunks;
}


//WOTC
app.post('/teamRemove', function (req, res) {
	var coy = "-";
	var removeTeam = "";
	if(sess.company!=null){
		coy = sess.company;
	}
	var vehsToRemove = req.body.teamRemove;
	console.log("Removed Vehs: " + vehsToRemove);
	connection.query('UPDATE vehicle SET `team`=? WHERE id IN(?)', [removeTeam,vehsToRemove], function (error, results, fields) {
		if (error) throw error;
		res.redirect('/col');
	});
});

app.get('/getTeams', function (req, res) {
	var company = "";
	if(sess.company!=null){
		company = sess.company;
	}
	connection.query('SELECT DISTINCT team FROM vehicle WHERE company=?', [company], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});

app.get('/companies', function (req, res) {
	var company = "";
	if(sess.company!=null){
		company = sess.company;
	}
	connection.query('SELECT DISTINCT company FROM vehicle WHERE `company`=?', [company], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});


app.get('/getNoTeamVehicles', function (req, res) {
	var company = "";
	var team = "";
	if(sess.company!=null){
		company = sess.company;
	}
	connection.query('SELECT DISTINCT plate_num FROM vehicle WHERE company=? AND team=?', [company,team], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});


//Rest API to set vehicle profile
/* app.post('/setVehicle', function (req, res) {
	var company = "";
	var isUpdate = 0;
	if(sess.company!=null){
		company = sess.company;
	}
	var plateNum = req.body.vehicleSelect;
	var fuelRemaining = req.body.fuelRemain;
	var fuelCon = req.body.fuelCon;
	isUpdate = req.body.isUpdate;
	var fuelPrice = req.body.fuelPrice;
	var tyreWear = req.body.tyreWear;
	if(isUpdate==1){
		connection.query('UPDATE `vehicle` SET `company`=?,`fuel_remaining`=?,`fuel_consumption`=?,`fuel_price`=?,`tyre_wear`=? WHERE `plate_num`=?', [company,fuelRemaining,fuelCon,fuelPrice,tyreWear,plateNum], function (error, results, fields) {
			if (error) throw error;
			//req.flash('success', 'Vehicle settings saved');
			res.redirect('/profile');
		});
	}else{
		connection.query('INSERT INTO vehicle SET `company`=?,`plate_num`=?,`fuel_remaining`=?,`fuel_consumption`=?,`fuel_price`=?,`tyre_wear`=?', [company,plateNum,fuelRemaining,fuelCon,fuelPrice,tyreWear], function (error, results, fields) {
		if (error) throw error;
			//req.flash('success', 'Vehicle settings saved');
			res.redirect('/profile');
		});
	}
}); */

app.post('/setVehicleInfo', function (req, res) {
	var company = "";
	var isUpdate = 0;
	if(sess.company!=null){
		company = sess.company;
		var fuelRemaining = req.body.fuelRemain;
		var fuelCon = req.body.fuelCon;
		var fuelPrice = req.body.fuelPrice;
		var vehicleOrTeam = req.body.vehicleSelect;
		/* var tyreWear = req.body.tyreWear; */
		connection.query('UPDATE `vehicle` SET `fuel_remaining`=?,`fuel_consumption`=?,`fuel_price`=? WHERE `plate_num`=? OR `team`=? AND `company`=?', [fuelRemaining,fuelCon,fuelPrice,vehicleOrTeam,vehicleOrTeam,company], function (error, results, fields) {
			if (error) throw error;
			//req.flash('success', 'Vehicle settings saved');
			res.redirect('/profile');
		});
	}else{
		res.redirect('/');
	}
}); 


app.get('/logout',function(req,res){
	req.session.destroy(function(err) {
		if(err) {
			console.log(err);
		} else {
			res.redirect('/');
		}
	});
});
//rest api to update record into mysql database
app.put('/node', function (req, res) {
	connection.query('UPDATE `node` SET `vehicle`=?,`company`=?,`lat`=?,`lon`=?,`roadname`=? where`id`=?', [req.body.vehicle,req.body.company,req.body.lat, req.body.lng,req.body.roadname, req.body.id], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
	});
});

//rest api to delete record from mysql database
app.delete('/node', function (req, res) {
	console.log(req.body);
	connection.query('DELETE FROM `node` WHERE `id`=?', [req.body.id], function (error, results, fields) {
		if (error) throw error;
		res.end('Record has been deleted!');
	});
});

function parseTime(timeStr) {
   var timeVal = timeStr.split(':');
   return parseInt(timeVal[0]) * 60 + parseInt(timeVal[1]);
}

//this is the code to test straight line for distances
/* function distances(){
	var start = now();
	var limitVal = 300000;
	connection.query('SELECT ROUND(lat,4),ROUND(lon,4) FROM `node` LIMIT ?', [limitVal], function (error, results, fields) {
		if (error) throw error;
		
		var lat2 = 0;
		var lon2 = 0;
		for(var x=0;x<results.length;x++){
			var lat1 = results[x].lat;
			var lon1 = results[x].lon;
			if(x<results.length-1){
				lat2 = results[x+1].lat;
				lon2 = results[x+1].lon;
			}else{
				break;
			}
			
			//var stLineDist = haversineDistance(lat1,lon1,lat2,lon2);
			var stLineDist = myDistance(lat1,lon1,lat2,lon2);
		}
		var end = now();
		var timeTaken = end-start;
		console.log("Time taken: " + timeTaken.toFixed(3) + "ms");
	});
} */

function myDistance(lat1,lon1,lat2,lon2){
	var ddConst = 111.321;
	var xDiff = Math.abs(lat2-lat1);//xDiff<0 ? (lat2-lat1)*-1 : lat2-lat1;
	var yDiff = Math.abs(lon2-lon1);//yDiff<0 ? (lon2-lon1)*-1 : lon2-lon1;
	var lineDist = Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
	if(lineDist<1){
		var dist = lineDist*ddConst;
		return dist;
	}	
}


function haversineDistance(lat1,lon1,lat2,lon2,isMiles) {
  function toRad(x) {
    return x * Math.PI / 180;
  }

  var R = 6371; // km

  var x1 = lat2 - lat1;
  var dLat = toRad(x1);
  var x2 = lon2 - lon1;
  var dLon = toRad(x2)
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;

  if(isMiles) d /= 1.60934;

  return d;
}

// ================================================================
// setup our express application
// ================================================================
app.use('/public', express.static(process.cwd() + '/public'));
app.set('view engine', 'ejs');
// ================================================================
// setup routes
// ================================================================
routes(app);