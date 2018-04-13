
module.exports = function(app) {
	function getFilesizeInBytes(filename) {
		const stats = fs.statSync(filename)
		const fileSizeInBytes = stats.size
		return fileSizeInBytes
	}

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
	function getSum(total, num) {
		return total + num;
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
}
module.exports = util;

