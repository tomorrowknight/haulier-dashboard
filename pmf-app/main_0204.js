var http = require('http');
var fs = require('fs');
// var https = require('https');
var express = require('express');
var Busboy = require('busboy');
var session = require('express-session');
var getRawBody = require('raw-body')
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
var now = require('performance-now');
var schedule = require('node-schedule');
var Excel = require('exceljs');
var DEL = require('node-delete');
var locks = require('locks');
const saltRounds = 12;


//start mysql connection
var connection = mysql.createConnection({
	host     : 'localhost', //mysql database host name
	user     : 'root', //mysql database user name
	password : 'moeproject16db!', //mysql database password
	database : 'tracks_dev', //mysql database name
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
//This limits filesize uploads

//for future https use
/* var options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/key-cert.pem')
};
 */
//var server = https.createServer(options,app);
//create app server
var server = app.listen(6789,"dev.logistics.lol", function () {

	var host = server.address().address
	var port = server.address().port

	console.log("HPD app listening at http://%s:%s", host, port)
	var today = new Date();
	console.log("Time now is: " + today);

});


app.use(session({
secret: 'pmfcoiscm',
resave: true,
saveUninitialized: false,
duration: 360000,
activeDuration: 600000,
cookie: { maxAge: 900000 }
}));

app.use(flash());

app.use(function(req, res, next){
/*     res.locals.success_messages = req.flash();
    res.locals.error_messages = req.flash('error_messages'); */
	if ('HEAD' == req.method || 'OPTIONS' == req.method) return next();

    // break session hash / force express to spit out a new cookie once per second at most
    req.session._garbage = Date();
    req.session.touch();
	res.locals.err_msg = req.session.errMsg;
	res.locals.err_type = req.session.errType;
	res.locals.userInfo = req.session.username;
    next();
});

//app.use(fileUpload());
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
}));


//var req.session;



/* app.get('/login',function(req,res){
req.session = req.session;
req.session.username;
//Session set when user Request our app via URL
if(req.session.username) {

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
//SEQ001
var j = schedule.scheduleJob("*/3 * * * *", function(){
	//getFirstDate();
	removeBadEntries();
	doDataFixes();
	
});

//SELECT * FROM `node` WHERE datetime BETWEEN "2017-07-23" AND "2017-07-24" 

function getDateCount(dt1,dt2,veh){
	var counterDate = 0;
	return new Promise(function(resolve, reject) {
		connection.query('SELECT COUNT(*) AS ctr FROM `node` WHERE datetime BETWEEN ? AND ? AND `vehicle`=?', [dt1,dt2,veh], function (error, results, fields) {
			if (error) reject(error);
			if(results.length){
				counterDate = results[0].ctr;
				resolve(counterDate);	
			}

		});
	});
}

//Done to replace utilTimeX function 01-03-2018 WT001
function getWorkTime(dateStart,dateEnd,vehicleNum,company){
	var speedMin = 0;
	var speedMax = 90;
	return new Promise(function(resolve, reject) {
		var q = 'SELECT COUNT(*) AS worktime FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND company=? AND speed BETWEEN ? and ? ORDER BY id,datetime' ;
		var sqlQuery = connection.query(q,[dateStart,dateEnd,vehicleNum,company,speedMin,speedMax], function (error, results, fields) {
			if (error) reject(error);
			if(results.length){
				var workTime = results[0].worktime;
				resolve(workTime);
			}
		});
	});
}
	
//New methods edited on 28-02-2018
/* function getUtilTimeX(dateStart,dateEnd,vehicleNum,company){
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
} */

function storeProcessedData(date,vehicle,workTime,company){
	connection.query('INSERT INTO processed_data SET `date`=?,`vehicle`=?,`work_time`=?,`company`=?', [date,vehicle,workTime,company], function (error, results, fields) {
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
//removeGPSError("2017-07-11","2017-07-12","XD5757P");
function getDataForRemoval(dateStart,dateEnd,vehicle){
	var selQuery = 'SELECT * FROM `node` WHERE `datetime` BETWEEN ? AND ? AND vehicle=? ORDER BY id';
	//var delQuery = 'DELETE FROM `node` WHERE id BETWEEN ? AND ? and lat=? ';
	return new Promise(function(resolve, reject){
		connection.query(selQuery,[dateStart,dateEnd,vehicle], function (error, results, fields) {
			if (error) reject (error);
			if(results.length){
				//console.log("Inside GPS Error removal of length = " + results.length);
				var data = results;
				resolve(data);
			}
		});
	});	
}

function getSpeedDifference(node1,node2){
		var distBtwnNodes = haversineDistance(node1.lat,node1.lon,node2.lat,node2.lon,false);
		var thisNodeDate = Date.parse(node1.datetime);
		var nextNodeDate = Date.parse(node2.datetime);
		var timeDiff = (nextNodeDate-thisNodeDate)/60000;
		return (distBtwnNodes/timeDiff)*60;
}


function findGPSError(data,dateStart,dateEnd,vehicle){
	var lastGoodGPSIndex= 0;
	var oneDay = 86400000;
	var anomalies = [];
	return new Promise(function(resolve, reject){		
		for(var i=0;i<data.length-1;i++){
			var iVal = i;
			var goodGPSNode = data[lastGoodGPSIndex];
			var currentGPSNode = data[i];
			var speedDiff = getSpeedDifference(goodGPSNode,currentGPSNode);
			if(speedDiff>=85){
				anomalies.push(currentGPSNode.id);
			}else{
				lastGoodGPSIndex = iVal;
				//console.log("Nope no problems yet")
			}
			if(iVal==data.length-2){
				resolve(anomalies);
			}
		}
		
		
	});
}


function removeGPSError(data,dateStart,dateEnd,vehicle){
	var isTraversed = false;
	var rowCtr = 0;
	var delQuery = 'DELETE FROM `node` WHERE id IN(?)';
	return new Promise(function(resolve, reject){	
		if(data.length){
			console.log("remove GPSErr len: " +data.length);
			for(var x=0;x<data.length;x++){
				var ctr = x;
				var anomaly = data;
				connection.query(delQuery,[anomaly], function (error, results, fields) {
					//console.log("deleting GPS errors")
					if (error) throw error;
						//console.log("Affected Rows: " + results.affectedRows);
						if(results.affectedRows>=0){
							rowCtr += results.affectedRows;
							//console.log("IS TRAVERSED SIA");
							console.log( "---- ROW COUNTER FOR DELETING GPS ERRORS HERE---> " + rowCtr);
							isTraversed = true;
						}
					//refNode = thisNode;
				});

					resolve(isTraversed);
			}
		}
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
	var isDeleted = 0;
	return new Promise(function(resolve, reject) {
		connection.query('DELETE FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=?', [datetime1,datetime2,vehicle], function (error, results, fields) {
			if (error) reject(error);
			if(results.affectedRows>0){
				isDeleted == 1;
				setTimeout(() => {
					console.log('promise - Delete Data');
					resolve(isDeleted);
				}, 1000);
			}
		});
	});
}

function removeLargeGaps(datetime1,datetime2,vehicle,company){
	var isRemoved = 0;
	var hoursToOmit = 7200000; //epoch time in ms 7200000 is 2 hours
	var sqlQuery = 'SELECT id,datetime,lat,lon FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=?';
	return new Promise(function(resolve, reject) {
		connection.query(sqlQuery, [datetime1,datetime2,vehicle,company], function (error, results, fields) {
			if(results.length){
				for(var i=0;i<results.length-1;i++){
					var ctr = i;
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
							if (error) reject(error);
								if(results.affectedRows>0){
									isRemoved = 1;
								}
								if(results.affectedRows>=0){
									resolve(isRemoved);
								}
							});	
						}
					}
				}
				resolve(isRemoved);
				console.log('Hello from the end of remove large gaps');
				
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
	var q = "SELECT lat,lon FROM node WHERE `datetime` BETWEEN ? AND ? AND vehicle=? AND company=? ORDER BY datetime";
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

function delay(t, v) {
   return new Promise(function(resolve) { 
       setTimeout(resolve.bind(null, v), t)
   });
}

console.log("Haversine Dist: " + haversineDistance(1.304885,103.627607,1.306752,103.628305));

//FIXDATA001
function doDataFixes(){
    var dataItem = [];
    var promiseCounter = 0;
    connection.query('SELECT datetime,vehicle,company from node WHERE speed>0 ORDER BY id LIMIT 1',function (error, results, fields) {
		if(results.length>0){
		wait(500);
            var dt = results[0].datetime;
            var veh = results[0].vehicle;
            var company = results[0].company;
            var dateStr = dt.substr(0,dt.indexOf(' '));
            var dateObj = Date.parse(dt);
            var utStart = Date.parse(dateObj).getTime()/1000;
            var tmrDate = new Date((utStart + 3600*24)*1000);
            var dateStrTmr = tmrDate.toString("yyyy-MM-dd");
			console.log("Start DataFix..");
			fixData(dateStr,dateStrTmr,veh,company)
			   .then((isComplete) => console.log("FixData: " + isComplete))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE FixZeroAbove: " + counterDate))
			   .then(() => fixDatav1(dateStr,dateStrTmr,veh,company))
			   .then((finish) =>console.log("isFinish: " + finish))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE removeGPSErr: " + counterDate))
			   .then(() => getDataForRemoval(dateStr,dateStrTmr,veh))
			   .then((data) => findGPSError(data,dateStr,dateStrTmr,veh,company))
			   .then((anomalies) => {
					if (anomalies.length>0) {
						return removeGPSError(anomalies,dateStr,dateStrTmr,veh);
					}else{
						console.log("No anomalies in GPS Data")
					}
				})
			   //.then(delay(3000))
			   .then(() => removeLargeGaps(dateStr,dateStrTmr,veh,company))
			   .then((isRemoved) => getDataforFixv2(dateStr,dateStrTmr,veh,company))
			   .then((results) => fixDatav2(results,dateStr,dateStrTmr,veh,company))
			   .then((fixedNodes) => {
					if (fixedNodes.length>0) {
						return processFixDatav2(fixedNodes,dateStr,dateStrTmr,veh,company);
					}else{
						console.log("No node fixes")
					}
				})
			   .then(() => getChartResults()) 
			   .catch((err) => setImmediate(() => { throw err; })); 
		}
	});
}

function getChartResults(){
    var dataItem = [];
    var promiseCounter = 0;
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
			console.log("Start Calculating ChartResults...");
			getWorkTime(dateStr,dateStrTmr,veh,company)
			   .then((workTime) => storeProcessedData(dateStr,veh,workTime,company))
			   .then(() => getAllFenceIds(veh,dateStr,dateStrTmr,company))
			   .then((isDone) => {
					if (isDone>0) {
						console.log("All Fence IDs");
						return getPlacement(dateStr,dateStrTmr,veh);
					}else{
						console.log("NO Fence IDs")
					}
				})
				.then((placement) => {
					if (placement>0) {
						return getStopData(dateStr,dateStrTmr,veh,company);
					}
				})
				.then((stopCount) => {
					if (stopCount) {
						console.log("Stop Count: " + stopCount);
						return updateProcessedDataStop(stopCount,dateStr,veh);
					}
				})
				.then(() => getMoveData(dateStr,dateStrTmr,veh,company))
				.then((moveCount) => {
					if (moveCount) {
					   console.log("Move Count: " + moveCount);
					updateProcessedDataMove(moveCount,dateStr,veh);
					}
				})
				.then(() => consolidateFenceData(dateStr,dateStrTmr,veh,company))
				.then((results) => {
					if(results.length){
						storeProcessedAreas(dateStr,veh,results,company)
						var svcTime = results.reduce(getSum);
						updateProcessedDataService(svcTime,dateStr,veh);
					}
				})
				.then(() => getTravelDistance(dateStr,dateStrTmr,veh,company))
				.then((totalDist) => updateProcessedDataTravelDistance(totalDist,dateStr,veh))
				.then(() => removeProcessedData(dateStr,dateStrTmr,veh))
				.then((isDeleted) => doDataFixes())
				.catch((err) => setImmediate(() => { throw err; })); 
		}
    });
}

function getFirstDate(){
    var dataItem = [];
    var promiseCounter = 0;
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
			console.log("Got results...");
			getDateCount(dateStr,dateStrTmr,veh)
			.then((counterDate) => console.log("CTRDATE ORIGIN: " + counterDate))
			   .then(() => fixData(dateStr,dateStrTmr,veh,company))
			   .then((isComplete) => console.log("FixData: " + isComplete))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE FixZeroAbove: " + counterDate))
			   .then(() => fixDatav1(dateStr,dateStrTmr,veh,company))
			   .then((finish) => getDataForRemoval(dateStr,dateStrTmr,veh))
			   .then((data) => findGPSError(data,dateStr,dateStrTmr,veh,company))
			   .then((anomalies) => {
					if (anomalies.length>0) {
						return removeGPSError(anomalies,dateStr,dateStrTmr,veh);
					}else{
						console.log("No anomalies in GPS Data")
					}
				})
			   .then((isTraversed) =>console.log("isTraversed: " + isTraversed))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE removeGPSErr: " + counterDate))
			   .then(() => removeLargeGaps(dateStr,dateStrTmr,veh,company))
			   .then((isRemoved) => console.log("removeLargeGaps: " + isRemoved))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE lg gap: " + counterDate))
			   .then(() => fixDatav2(dateStr,dateStrTmr,veh,company))
			   .then(() => getWorkTime(dateStr,dateStrTmr,veh,company))
			   .then((workTime) => storeProcessedData(dateStr,veh,workTime,company))
			   .then(() => getAllFenceIds(veh,dateStr,dateStrTmr,company))
			   .then((isDone) => {
					if (isDone>0) {
						console.log("All Fence IDs");
						return getPlacement(dateStr,dateStrTmr,veh);
					}else{
						console.log("NO Fence IDs")
					}
				})
				.then((placement) => {
					if (placement>0) {
						return getStopData(dateStr,dateStrTmr,veh,company);
					}
				})
				.then((stopCount) => {
					if (stopCount) {
						console.log("Stop Count: " + stopCount);
						return updateProcessedDataStop(stopCount,dateStr,veh);
					}
				})
				.then(() => getMoveData(dateStr,dateStrTmr,veh,company))
				.then((moveCount) => {
					if (moveCount) {
					   console.log("Move Count: " + moveCount);
					updateProcessedDataMove(moveCount,dateStr,veh);
					}
				})
				.then(() => consolidateFenceData(dateStr,dateStrTmr,veh,company))
				.then((results) => {
					if(results.length){
						storeProcessedAreas(dateStr,veh,results,company)
						var svcTime = results.reduce(getSum);
						updateProcessedDataService(svcTime,dateStr,veh);
					}
				})
				.then(() => getTravelDistance(dateStr,dateStrTmr,veh,company))
				.then((totalDist) => updateProcessedDataTravelDistance(totalDist,dateStr,veh))
				.then(() => removeProcessedData(dateStr,dateStrTmr,veh))
				.then((isDeleted) => getFirstDate())
				.catch((err) => setImmediate(() => { throw err; })); 
		}
    });
}
//FD001
/* function getFirstDate(){
    var dataItem = [];
    var promiseCounter = 0;
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
			console.log("Got results...");
			getDateCount(dateStr,dateStrTmr,veh)
			.then((counterDate) => console.log("CTRDATE ORIGIN: " + counterDate))
			   .then(() => fixData(dateStr,dateStrTmr,veh,company))
			   .then((isComplete) => console.log("FixData: " + isComplete))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE FixZeroAbove: " + counterDate))
			   .then(() => fixDatav1(dateStr,dateStrTmr,veh,company))
			   .then((finish) => getDataForRemoval(dateStr,dateStrTmr,veh))
			   .then((data) => findGPSError(data,dateStr,dateStrTmr,veh,company))
			   .then((anomalies) => {
					if (anomalies.length>0) {
						return removeGPSError(anomalies,dateStr,dateStrTmr,veh);
					}else{
						console.log("No anomalies in GPS Data")
					}
				})
			   .then((isTraversed) =>console.log("isTraversed: " + isTraversed))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE removeGPSErr: " + counterDate))
			   .then(() => removeLargeGaps(dateStr,dateStrTmr,veh,company))
			   .then((isRemoved) => console.log("removeLargeGaps: " + isRemoved))
			   .then(() => getDateCount(dateStr,dateStrTmr,veh))
			   .then((counterDate) => console.log("CTRDATE lg gap: " + counterDate))
			   .then(() => fixDatav2(dateStr,dateStrTmr,veh,company))
			   .then(() => getWorkTime(dateStr,dateStrTmr,veh,company))
			   .then((workTime) => storeProcessedData(dateStr,veh,workTime,company))
			   .then(() => getAllFenceIds(veh,dateStr,dateStrTmr,company))
			   .then((isDone) => {
					if (isDone>0) {
						console.log("All Fence IDs");
						return getPlacement(dateStr,dateStrTmr,veh);
					}else{
						console.log("NO Fence IDs")
					}
				})
				.then((placement) => {
					if (placement>0) {
						return getStopData(dateStr,dateStrTmr,veh,company);
					}
				})
				.then((stopCount) => {
					if (stopCount) {
						console.log("Stop Count: " + stopCount);
						return updateProcessedDataStop(stopCount,dateStr,veh);
					}
				})
				.then(() => getMoveData(dateStr,dateStrTmr,veh,company))
				.then((moveCount) => {
					if (moveCount) {
					   console.log("Move Count: " + moveCount);
					updateProcessedDataMove(moveCount,dateStr,veh);
					}
				})
				.then(() => consolidateFenceData(dateStr,dateStrTmr,veh,company))
				.then((results) => {
					if(results.length){
						storeProcessedAreas(dateStr,veh,results,company)
						var svcTime = results.reduce(getSum);
						updateProcessedDataService(svcTime,dateStr,veh);
					}
				})
				.then(() => getTravelDistance(dateStr,dateStrTmr,veh,company))
				.then((totalDist) => updateProcessedDataTravelDistance(totalDist,dateStr,veh))
				.then(() => removeProcessedData(dateStr,dateStrTmr,veh))
				.then((isDeleted) => getFirstDate())
				.catch((err) => setImmediate(() => { throw err; })); 
		}
    });
}
 */
function sleepTimer(ms) {
  return function(x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
  };
}

/* 
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
			fixData(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("Check Inaccurate Data End : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));	
			//wait(1000);
			fixDatav1(dateStr,dateStrTmr,veh,company).then(function(results){
				console.log("Check Inaccurate Data End : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));	
			//wait(1000);
            /*removeGPSError(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("CHECK GPS Error : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; })); 
			removeLargeGaps(dateStr,dateStrTmr,veh,company).then(function(results) {
				console.log("CHECK LARGE GAP : " + results.length);
			}).catch((err) => setImmediate(() => { throw err; }));
			//wait(1000);
			fixDatav2(dateStr,dateStrTmr,veh,company).then(function(counter) {
				//console.log(counter);
			}).catch((err) => setImmediate(() => { throw err; }));
			//wait(1000);
			//removeDuplicateRows();
			getUtilTimeX(dateStr,dateStrTmr,veh,company).then(function(utilTimeX) {
				//wait(1000);
				storeProcessedData(dateStr,veh,utilTimeX,company);
			}).catch((err) => setImmediate(() => { throw err; }));
			getTravelDistance(dateStr,dateStrTmr,veh,company).then(function(totalDist) {
				//wait(1000);
				updateProcessedDataTravelDistance(totalDist,dateStr,veh);
			}).catch((err) => setImmediate(() => { throw err; }));
			getAllFenceIds(veh,dateStr,dateStrTmr,company).then(function(isDone){
				//wait(1000);
				console.log("Is Done: " + isDone);
				if(isDone>0){
					getPlacement(dateStr,dateStrTmr,veh).then(function(placement){
						if(placement>0){
							//wait(2000);
							getStopData(dateStr,dateStrTmr,veh,company).then(function(stopCount){
								if(stopCount>0){
									console.log("Stop Count: " + stopCount);
									//wait(2000);
									updateProcessedDataStop(stopCount,dateStr,veh);	
									getMoveData(dateStr,dateStrTmr,veh,company).then(function(moveCount){
										if(moveCount>0){
											console.log("Move Count: " + moveCount);
											//wait(2000);
											updateProcessedDataMove(moveCount,dateStr,veh);
											consolidateFenceData(dateStr,dateStrTmr,veh,company).then(function(results){
												if(results.length){
													storeProcessedAreas(dateStr,veh,results,company);
													var svcTime = results.reduce(getSum);
													updateProcessedDataService(svcTime,dateStr,veh);
													removeProcessedData(dateStr,dateStrTmr,veh);
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
} */

function getSum(total, num) {
    return total + num;
}


/* app.get('/setErrorMsg/:errorMsg', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
		req.session.errMsg = req.params.errorMsg;
		errVerify= "done";
	}
		res.end();
});


app.get('/getErrorMsg', function (req, res) {
	var isDone = "done";
	req.session.errVerify = isDone;
	if(req.session.company!=null){
		var company = req.session.company;

		var currErrMsg = req.session.errMsg;
		var results = JSON.stringify(currErrMsg);
	}
		res.end(results);
}); */


//----NEW TEAM FUNCTIONS 09-01-10

app.get('/workTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`work_time`) AS work_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num AND processed_data.company = ? WHERE (plate_num=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
});

/* app.get('/workTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
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
}); */

app.get('/moveTimeTeam/dateStart/:dateStart/dateEnd/:dateEnd/team/:team/', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`move_time`) as move_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num AND processed_data.company = ? WHERE (plate_num= ? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`unknown_stop`) AS unknown_stop FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num AND processed_data.company = ? WHERE (`plate_num`=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
		var teamVal = unescape(req.params.team);
		console.log(teamVal);
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`service_time`) AS service_time FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num AND processed_data.company = ? WHERE (`plate_num`=? OR `team`= ? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q, [company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		var q = "";
		q = "SELECT AVG(`service_time`) AS service_time,fence_type FROM processed_areas INNER JOIN vehicle ON processed_areas.vehicle = vehicle.plate_num AND processed_areas.company = ? WHERE (`plate_num`=? OR `team`=? OR processed_areas.company=?) AND processed_areas.date BETWEEN ? AND ? GROUP BY fence_type";
		var sqlQuery = connection.query(q, [company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
		var q = "";
		q = "SELECT AVG(`travel_distance`) AS travel_distance FROM processed_data INNER JOIN vehicle ON processed_data.vehicle = vehicle.plate_num AND processed_data.company = ? WHERE (`plate_num`=? OR `team`=? OR processed_data.company=?) AND processed_data.date BETWEEN ? AND ?";
		var sqlQuery = connection.query(q,[company,req.params.team,req.params.team,req.params.team,req.params.dateStart,req.params.dateEnd], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
		var q = "";
		q = "SELECT AVG(`fuel_consumption`) AS fuel_consumption, AVG(`fuel_remaining`) AS fuel_remaining, AVG(`fuel_price`) AS fuel_price FROM vehicle WHERE `plate_num`=? OR `team`=? AND company=? ";
		var sqlQuery = connection.query(q,[req.params.team,req.params.team,company], function (error, results, fields) {
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
	if(req.session.company!=null){
		var company = req.session.company;
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

function getFilesizeInBytes(filename) {
    const stats = fs.statSync(filename)
    const fileSizeInBytes = stats.size
    return fileSizeInBytes
}

app.post('/uploadData', function (req, res) {
	errMsg = "";
	errType = "";
	if(req.session.company!=null){
		var errorWrongFile = "Wrong File Type";
		var company = req.session.company;
		var timestamp = Math.round(new Date().getTime()/1000);
		if(!req.files){
			res.render('pages/upload');
			return res.status(400).send('No files were uploaded.');
		}
		let sampleFile = req.files.file;
		var initialURL = '/home/safe/pmf/pmf-dev-p2/pmf-app/';
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
		var fileSize = getFilesizeInBytes(newAddr)/1000000;
		//checks for filesize in MB
			console.log("FILESIZE:" + fileSize);
			if(fileSize>10){
				errMsg = "File size is too large";
				errType = "X";
				fs.unlink(newAddr, (err) => {
					if (err) throw err;
					console.log('path/file.txt was deleted');
				});
				res.redirect("/upload");
				res.finished = true;
				return;
			}
			if (err){
				console.log("Err sampleFile");
				 res.render('pages/upload');
				return res.status(500).send(err);
			}else{
				try{
					var workbook = XLSX.readFile(newAddr,{sheetStubs:true});
					var worksheet = workbook.Sheets[workbook.SheetNames[0]];
					var anotherSheet = workbook.Sheets[workbook.SheetNames[1]];
					//console.log(anotherSheet.A1);
					if(anotherSheet != null){
						errMsg = "Cannot upload file with multiple sheets";
						errType = "X";
						res.redirect("/upload");
						res.finished = true;
						return;
					}else{
						anotherSheet = null;
					}
					var checkCellA1 = worksheet.A1;
					var checkCellA2 = worksheet.A2;
					var checkCellA3 = worksheet.A3;
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
						return;
					}
					var cellStartDate = worksheet['A3'];
					var cellEndDate = worksheet['A4'];
					var vehicleNum= vehicleCelVal.substring(9,16);
					console.log("Vehicle Num len: "+ vehicleNum.length);
					if(vehicleNum.trim() == "" || vehicleNum.length!=7){
						errType = "X";
						errMsg = "Incorrect Vehicle Number";
						res.redirect("/upload");
						res.finished = true;
						return;						
					}
					cellVehicle.v = "";
					cellCompanyFN.v = "";
					cellStartDate.v = "";
					cellEndDate.v = "";
					console.log("Check vehicle number truncating: " + vehicleNum);
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
	if(req.session.company!=null){
		var company = req.session.company;
		connection.query('select COUNT (*) AS idleCount from node where vehicle=? AND datetime<? AND speed<? AND company=?', [req.params.vehicle,req.params.datetime,req.params.speed,company], function (error, results, fields) {
			if (error) throw error;
			res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

app.get('/vehicleProfile/vehicle/:vehicle', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
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
	if(req.session.company!=null){
		var nodeArr = [];
		var company = req.session.company;
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
	}else{
		res.redirect('/');
	}
});

var teamStationaryArr = [];
app.get('/stationary/dateStart/:dateStart/dateEnd/:dateEnd/team/:vehicles/', function (req, res) {
	if(req.session.company!=null){
		var nodeArr = [];
		var teamArr = [];
		var company = req.session.company;
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
	if(req.session.company!=null){
		var company = req.session.company;
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

//This method is to get all the fences for everyone and for that particular company
app.get('/fenceTypes', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
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

//A comparator to compare if Ids are less or more than each other
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

//This removes silly data which has been uploaded due to odd formatting and also binds the coordinates to Singapore
function removeBadEntries(){
	var removeBadEntries = 0;
	var faultyDateTime = "0000-00-00 00:00";
	//Bounding Box of Singapore
	var boundingLat1 = 1.1496;
	var boundingLat2 = 1.4784;
	var boundingLon1 = 103.594;
	var boundingLon2 = 104.095;
	var sqlStmt = 'DELETE FROM `node` WHERE `datetime`= ? OR lat < ? OR lat > ? OR lon < ? OR lon > ?';
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[faultyDateTime,boundingLat1,boundingLat2,boundingLon1,boundingLon2], function (error, results, fields) {
		if (error) reject(error);
		if(results.affectedRows>0){
			removeBadEntries = results.affectedRows;
		}
		resolve(removeBadEntries);
		});
	});
}

//This removes data with 0 speed from the start of the data
function fixData(dateStart,dateEnd,vehicleNum,company){
  	var isComplete = 0;
	var speed = 0;
	var sqlStmt= 'SELECT id FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? AND `company`=? AND `speed`>? ORDER BY id ASC LIMIT 1';
	var q = 'DELETE FROM node where `id`<? AND `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=? ';
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[dateStart,dateEnd,vehicleNum,company,speed], function (error, results, fields) {
			if(results.length){
					var nodeID = results[0].id;
					var sqlQuery2 = connection.query(q,[nodeID,dateStart,dateEnd,vehicleNum,company], function (error, results, fields) {
					if (error) reject(error);
					if(results.affectedRows>0){
						isComplete = 1;
					}
					if(results.affectedRows>=0){
						setTimeout(() => {
							resolve(isComplete);
						}, 1000);
					}
					});			
			}
		});
	});
}

//This removes data with 0 speed from the tail end of the data
function fixDatav1(dateStart,dateEnd,vehicleNum,company){
  	var finish = 0;
	var speed = 0;
	var sqlStmt= 'SELECT id FROM node WHERE `datetime` BETWEEN ? AND ? AND `vehicle`=? AND `company`=? AND `speed`>? ORDER BY id DESC LIMIT 1 ';
	var q = 'DELETE FROM node where `id`>? AND `datetime` BETWEEN ? AND ? AND `vehicle`=? and `company`=? ';
	return new Promise(function(resolve, reject) {
		var sqlQuery = connection.query(sqlStmt,[dateStart,dateEnd,vehicleNum,company,speed], function (error, results, fields) {
			if(results.length){
				var nodeID = results[0].id;
				var sqlQuery2 = connection.query(q,[nodeID,dateStart,dateEnd,vehicleNum,company], function (error, results, fields) {
				if (error) reject(error);
					if(results.affectedRows>0){
						finish = 1;
					}
					if(results.affectedRows>=0){
						setTimeout(() => {
							resolve(finish);
						}, 1000);
					}
				});
			}
		});
	});
}

//Retrieving the data for the fix to smooth out the gaps in the received data - accuracy to 1 minute
function getDataforFixv2(startDate,endDate,vehicleNum,company){
	var sqlStmt = 'SELECT * from node where `datetime` BETWEEN ? AND ? AND vehicle=? AND company=? ORDER BY id ASC';
	return new Promise(function(resolve, reject) {
		connection.query(sqlStmt,[startDate,endDate,vehicleNum,company],function (error, results, fields) {
			if (error) reject (error);
			if(results.length){
				resolve(results);
			}	
		});
	});
}

//Main bulk of the fixes the data to smooth out the gaps in the received data - accuracy to 1 minute
function fixDatav2(results,startDate,endDate,vehicleNum,company){
	var sd = startDate;
	var ed = endDate;
	var vhNum = vehicleNum;
	var counter= 0;
	var count = 0;
	var finalLen = 0;
	var fixDate = "";
	var tempArr = [];
	var isComplete = false;
	var fixedNodes = [];
	var dateDiffMinus = 0;
	var company = results[0].company;
	var referenceNode = results[0];
	var tempNode = results[0];
	return new Promise(function(resolve, reject) {
		for(var i=0;i<results.length;i++){
			var iVal = i;
			var fixNode = [];
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
					counter++;
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
						var newSpeed = parseFloat(stLineDist/(dateDiff/60)).toFixed(2);
						if(newSpeed<1){
							tempNode.speed = 1;
						}else{
							tempNode.speed = Math.round(newSpeed);
						}
						if(x<=dateDiffMinus){
							fixNode.push(tempNode.datetime,latitude,longitude,tempNode.roadname,tempNode.speed,tempNode.vehicle,tempNode.company);
							fixedNodes.push(fixNode);
							fixNode = [];
						}
					}
				referenceNode = iterNode;
			}
		
			finalLen =iVal;
			
		}
		setTimeout(() => {
			console.log('promise - fixDatav2 finalLen: ' + finalLen + ' actual len: ' + results.length + "Fix Nodes array len: " + fixedNodes.length);
			resolve(fixedNodes);
		}, 3000);
	});
}

//this fixes the data to smooth out the gaps in the received data - accuracy to 1 minute
function processFixDatav2(data,startDate,endDate,vehicleNum,company){
	var insertQuery = "INSERT INTO `node` (datetime,lat,lon,roadname,speed,vehicle,company) VALUES ?";
	var counterX = 0;
	return new Promise(function(resolve, reject) {
		if(data.length){
			connection.query(insertQuery,[data], function (error, results, fields) {
				if (error) throw (error);
					if(results.affectedRows>0){
						resolve(counterX);
					}
			});
		}
	});
}

//This removes any speed which is deemed too much for a haulier to travel at 
function removeHighSpeed(){
	var delQuery = "DELETE FROM `node` WHERE `speed` > 85";
	var isHighSpeedGone = 0;
	return new Promise(function(resolve, reject) {
		connection.query(delQuery, function (error, results, fields) {
			if (error) throw (error);
				if(results.affectedRows>=0){
					console.log("Delete high speeds" + results.affectedRows);
					isHighSpeedGone = 1;
					resolve(isHighSpeedGone);
				}
		});
	});
}


//Gets all the ids of the geo-fences in the database relevant to ALL and to the company
//All includes all ports and depots in SG and relevant to the company is what the companies demarcated
function getAllFenceIds(vehicle,datetime1,datetime2,company){
	var plateNum = vehicle;
	var fenceCount = 0;
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
					var nodeVal = i;
					var type = "";
					
					fenceId = results[i].id;
					var type = results[i].type;
					var sqlQuery2 = connection.query(sqlStmt2,[fenceId,type,datetime1,datetime2,vehicle,fenceId], function (error, results2, fields) {
						if (error) throw error;
						if(results2.length){
							for(var j=0;j<results2.length;j++){
								var count = j;
								var node = results2[j];
								var sqlQuery3 = connection.query(sqlStmt3,[node.datetime,node.vehicle,node.company,node.lat,node.lon,node.roadname,node.speed,node.id,node.fenceID,node.fenceType], function (error, results2, fields) {
									if (error) reject(error);
								});

							}
						//console.log(results.length + " - "+ fenceId);	
						}
					});
					
				}
				if(nodeVal==results.length-1){
					isDone=1;
					resolve(isDone);
				}
			}
		});
	});
}

//get distinct vehicle from the company 
app.get('/vehicles/', function (req, res) {
	if(req.session.company!=null){
		var coy = req.session.company;
		connection.query('SELECT DISTINCT plate_num FROM vehicle WHERE company=?',[coy], function (error, results, fields) {
			if (error) throw error;
			res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

//select distinct teams the company has
app.get('/teams/', function (req, res) {
	if(req.session.company!=null){
		var coy = req.session.company;
		console.log(coy);
		connection.query('SELECT DISTINCT team FROM vehicle where company=?',[coy], function (error, results, fields) {
		if (error) throw error;
		res.end(JSON.stringify(results));
		});
	}else{
		res.redirect('/');
	}
});

//Updating vehicle data 
function updateVehicleData(vehicleNum,company){
	var vehiclePlateNum = vehicleNum.substr(0,7);
	connection.query('INSERT INTO vehicle (plate_num,company) SELECT * FROM (SELECT ?,?) AS tmp WHERE NOT EXISTS (SELECT plate_num,company FROM vehicle WHERE plate_num=? AND company=?) LIMIT 1',[vehiclePlateNum,company,vehiclePlateNum,company], function (error, results, fields) {
		if (error) throw error;
	});	
}


//Gets vehicles from the newly uploaded data 15-01
function getNodeVehicles(){
	var vehicleNodeData = "";
	connection.query('SELECT DISTINCT vehicle,company FROM node', function (error, results, fields) {
		if (error) throw error;
		vehicleNodeData = results;
		getVehicleVehicles(vehicleNodeData);
	});
	
}

//Get unique vehicles
function getVehicleVehicles(vehicleNodeData){
	var vehicleData = "";
	connection.query('SELECT DISTINCT plate_num,company FROM vehicle', function (error, results, fields) {
		if (error) throw error;
		vehicleData = results;
		checkVehicles(vehicleNodeData,vehicleData);
	});
	
}

//Check if vehicles are duplicates
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

//Insertion of vehicles into database when newly uploaded and if not a duplicate
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

//Rest API to create a new geo-fence with the given text and geometric data 
app.post('/fenceData', function (req, res) {
	var coy = "-";
	if(req.session.company!=null){
		coy = req.session.company;
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

//Assign the vehicle to teams
app.post('/teamAssign', function (req, res) {
	var coy = "-";
	var removeTeam = "";
	if(req.session.company!=null){
		coy = req.session.company;
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


//substring chunking method
function chunkSubstr(str, size) {
	const numChunks = Math.ceil(str.length / size);
	const chunks = new Array(numChunks);

	for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
		chunks[i] = str.substr(o, size);
	}
	return chunks;
}


//Remove individual vehicles from teams
app.post('/teamRemove', function (req, res) {
	var coy = "-";
	var removeTeam = "";
	if(req.session.company!=null){
		coy = req.session.company;
	}
	var vehsToRemove = req.body.teamRemove;
	console.log("Removed Vehs: " + vehsToRemove);
	connection.query('UPDATE vehicle SET `team`=? WHERE id IN(?)', [removeTeam,vehsToRemove], function (error, results, fields) {
		if (error) throw error;
		res.redirect('/col');
	});
});

//get teams for specific company
app.get('/getTeams', function (req, res) {
	var company = "";
	if(req.session.company!=null){
		company = req.session.company;
	}
	connection.query('SELECT DISTINCT team FROM vehicle WHERE company=?', [company], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});

//select distinct companies
app.get('/companies', function (req, res) {
	var company = "";
	if(req.session.company!=null){
		company = req.session.company;
	}
	connection.query('SELECT DISTINCT company FROM vehicle WHERE `company`=?', [company], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});

//Get vehicles with no team
app.get('/getNoTeamVehicles', function (req, res) {
	var company = "";
	var team = "";
	if(req.session.company!=null){
		company = req.session.company;
	}
	connection.query('SELECT DISTINCT plate_num FROM vehicle WHERE company=? AND team=?', [company,team], function (error, results, fields) {
	if (error) throw error;
		//req.flash('success', 'Vehicle settings saved');
		res.end(JSON.stringify(results));
	});
});


//function to set the vehicle information like fuel remaining and fuel price
app.post('/setVehicleInfo', function (req, res) {
	var company = "";
	var isUpdate = 0;
	if(req.session.company!=null){
		company = req.session.company;
		var fuelRemaining = req.body.fuelRemain;
		var fuelCon = req.body.fuelCon;
		var fuelPrice = req.body.fuelPrice;
		var vehicleOrTeam = req.body.vehicleSelect;
		/* var tyreWear = req.body.tyreWear; */
		connection.query('UPDATE `vehicle` SET `fuel_remaining`=?,`fuel_consumption`=?,`fuel_price`=? WHERE `plate_num`=? OR `team`=? AND `company`=?', [fuelRemaining,fuelCon,fuelPrice,vehicleOrTeam,vehicleOrTeam,company], function (error, results, fields) {
			if (error) throw error;
			//req.flash('success', 'Vehicle settings saved');
			res.redirect('/vehicle-profile');
		});
	}else{
		res.redirect('/');
	}
}); 

//Function to destroy session object and logout
app.get('/logout',function(req,res){
	req.session.destroy(function(err) {
		if(err) {
			console.log(err);
		} else {
			res.redirect('/');
		}
	});
});

function parseTime(timeStr) {
   var timeVal = timeStr.split(':');
   return parseInt(timeVal[0]) * 60 + parseInt(timeVal[1]);
}


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


//New method 15-03
//SELECT fence.name FROM fenced_node INNER JOIN fence ON fenced_node.fenceID = fence.id WHERE (fenced_node.datetime BETWEEN "2017-07-10" AND "2017-07-11") AND fenced_node.vehicle="XD5756P" AND fenced_node.company="AW" GROUP BY fenced_node.datetime,fenced_node.fence_type ORDER BY fenced_node.datetime,fenced_node.id 
app.get('/actualFenceAreas/dateStart/:dateStart/dateEnd/:dateEnd/vehicle/:vehicle/', function (req, res) {
	if(req.session.company!=null){
		var company = req.session.company;
		//var minus_date = minusDate(req.params.dateStart,req.params.dateEnd);
		if(req.params.dateStart==req.params.dateEnd){
			var newDate = addDays(req.params.dateEnd,1);
			req.params.dateEnd = newDate;
		}
		var q = "";
		q = "SELECT COUNT(fenced_node.id) AS fence_time,fence.name,fence.lat,fence.lon,fence.type FROM fenced_node INNER JOIN fence ON fenced_node.fenceID = fence.id WHERE (fenced_node.datetime BETWEEN ? AND ?) AND fenced_node.vehicle=? AND fenced_node.company=? GROUP BY fenced_node.fenceID ORDER BY fenced_node.datetime,fenced_node.id";
		var sqlQuery = connection.query(q, [req.params.dateStart,req.params.dateEnd,req.params.vehicle,company], function (error, results, fields) {
			if (error) throw error;
			if(results.length){
				res.end(JSON.stringify(results));
			}
		});
	}else{
		res.redirect('/');
	}
}); 

function addDays(date,daystoAdd) {
  var result = new Date(date);
  result.setDate(result.getDate() + daystoAdd);
  return result;
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