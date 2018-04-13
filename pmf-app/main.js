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
require('datejs');
var copy = require('copy');
var async = require('async');
/* var fetch = require('node-fetch'); */
var now = require('performance-now');
var schedule = require('node-schedule');
var Excel = require('exceljs');
/* var DEL = require('node-delete'); */
var login = require('./routes/login.js');
var team = require('./routes/team.js');
const saltRounds = 12;
var connection = require('./routes/connect.js');
var util = require('./routes/util.js');

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
var server = app.listen(9090,"dev.logistics.lol", function () {

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

var j = schedule.scheduleJob("*/3 * * * *", function(){
	//getFirstDate();
	removeBadEntries();
	doDataFixes();
	
});

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

app.post('/flushData', function (req, res) {
	var isDeleted = 0;
	var company = req.session.company;
	var sqlQuery = 'DELETE FROM node WHERE company=?;DELETE FROM processed_data WHERE company=?;DELETE FROM processed_areas WHERE company=?;DELETE FROM fenced_node WHERE company=?';
	connection.query(sqlQuery, [company,company,company,company], function (error, results, fields) {
		if (error){
			throw(error);
		}
		res.end(JSON.stringify(results[3]));
	});
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

	//Updating vehicle data 
	function updateVehicleData(vehicleNum,company){
		var vehiclePlateNum = vehicleNum.substr(0,7);
		connection.query('INSERT INTO vehicle (plate_num,company) SELECT * FROM (SELECT ?,?) AS tmp WHERE NOT EXISTS (SELECT plate_num,company FROM vehicle WHERE plate_num=? AND company=?) LIMIT 1',[vehiclePlateNum,company,vehiclePlateNum,company], function (error, results, fields) {
			if (error) throw error;
		});	
	}

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

// ================================================================
// setup our express application
// ================================================================
app.use('/public', express.static(process.cwd() + '/public'));
app.set('view engine', 'ejs');
// ================================================================
// setup routes
// ================================================================
routes(app);
login(app);
team(app);
//connection(app);