var connection = require('./connect.js');

module.exports = function(app) {
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
}
