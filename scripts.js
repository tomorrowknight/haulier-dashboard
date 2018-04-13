<!-- views/partials/scripts.ejs -->

<!-- jQuery (necessary for Bootstrap's JavaScript plugins) -->
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!-- Bootstrap javascript file -->
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
<!-- Chart JS file -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.1.4/Chart.min.js"></script>
<!-- Google Maps API for Drawing and Places-->
<script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBCTuJa3H0LsqVo1UY0SNYCnMToiLlpFfY&libraries=drawing&callback=initMap"></script>


<script>
	var dataArray = []
	var dataArrFence = []
	var dataArrayFence = []
	var polygonArray = [];
	
	$( document ).ready(function() {
    getVehiclesAndTeam();
	});
	
	refCount = 0
	
	function partOne() {
		$.ajax({
			url : 'http://dev.logistics.lol:3000/node/vehicle/XB9597R/datetime/2015-01-08/speed/8',
			type : 'GET',
			dataType:'json',
			success : function(data) {              
				getDataOut(data[0].idleCount);
			},
		});
	}
	
	function initMap() {
		var latlng = new google.maps.LatLng(1.3521,103.819);
		var map = new google.maps.Map(document.getElementById('map'), {
		  center: latlng,
		  zoom: 13
		});
		
		var drawingManager = new google.maps.drawing.DrawingManager({
		  drawingMode: google.maps.drawing.OverlayType.MARKER,
		  drawingControl: true,
		  drawingControlOptions: {
		  position: google.maps.ControlPosition.TOP_CENTER,
		  drawingModes: ['polygon',]
		  },
		  markerOptions: {icon: 'https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png'},
		  circleOptions: {
			fillColor: '#ffff00',
			fillOpacity: 1,
			strokeWeight: 5,
			clickable: false,
			editable: true,
			zIndex: 1
		  }
		});
		drawingManager.setMap(map);
		
		google.maps.event.addListener(drawingManager, 'polygoncomplete', function(polygon) {
			for (var i = 0; i < polygon.getPath().getLength(); i++) {
			  document.getElementById('poly').innerHTML += polygon.getPath().getAt(i).toUrlValue(6) + "-";
			  
			}
			document.getElementById('poly').innerHTML += polygon.getPath().getAt(0).toUrlValue(6);
			polygonArray.push(polygon);
		});
		
		/*
		var searchBox = new google.maps.places.SearchBox(document.getElementById('pac-input'));
		map.controls[google.maps.ControlPosition.TOP_LEFT].push(document.getElementById('pac-input'));
		google.maps.event.addListener(searchBox, 'places_changed', function() {
		searchBox.setMap(map);
		
		var places = searchBox.getPlaces();

		var bounds = new google.maps.LatLngBounds();
		var i, place;
		for (i = 0; place = places[i]; i++) {
		   (function(place) {
			 var marker = new google.maps.Marker({
			   position: place.geometry.location
			 });
			 marker.bindTo('map', searchBox, 'map');
			 google.maps.event.addListener(marker, 'map_changed', function() {
			   if (!this.getMap()) {
				 this.unbindAll();
			   }
			 });
			 bounds.extend(place.geometry.location);


		   }(place));

		}
		map.fitBounds(bounds);
		searchBox.setMap(map);
		map.setZoom(Math.min(map.getZoom(),12));

		});*/

		google.maps.event.addDomListener(window, "load", initMap);
		
		
    }

	
	function dateTimePick(){
		$(function () {
			$('#dtPick').datetimepicker();
		});
	}
	
	function getAllFences() {
		$.ajax({
			url : 'http://dev.logistics.lol:3000/fence',
			type : 'GET',
			dataType:'json',
			success : function(data) {              
				findFences(data);
			},
		});
	}
	
	function findFences(someData) {
		var isDone = false;
		var fenceDataArr = [];
		for(count = 0;count<someData.length;count++){
			var latFence = someData[count].lat;
			var lonFence = someData[count].lon;
			$.ajax({
				url : 'http://dev.logistics.lol:3000/node/distance/loc/' + latFence + '/' + lonFence + '/datetime/2015-01-08',
				type : 'GET',
				dataType:'json',
				success : function(data) {
					getDataOutFence(data);	
				},
			});
		}

	}
	
	function getFences(){
		getAllFences();
	}
	/*
	jQuery(document).ready(function(){
        jQuery('#idleBtn').on('click', function(event) {        
             jQuery('#grid-1-2').toggle('show');
        });
    });
	jQuery(document).ready(function(){
        jQuery('#fenceBtn').on('click', function(event) {        
             jQuery('#grid-1-1').toggle('show');
        });
    });*/


	
	function getDataOut(data)
	{
		
		if (refCount == 1)
		{
			return;
		}
		refCount += 1
		dataArray.push(data)
		if (dataArray.length == 2)
		{	
			updateChart(dataArray[0], dataArray[1]);
		}
		refCount -=1;
	}
	
	function getDataOutFence(data){
		for(i=0;i<data.length;i++){
			dataArrayFence.push(data[0].fenceCount);
		}
		//console.log("daf size: " + dataArrayFence.length);
		if(dataArrayFence.length == 4){
			updateFenceChart(dataArrayFence);
		}
		
		
	}
	
	
	function updateChart(idle, active){
		var ctx = document.getElementById("myChart").getContext('2d');
		var myChart = new Chart(ctx, {
			type: 'pie',
			data: {
			labels: ["Stationary", "Move"],
			datasets: [{
				  backgroundColor: [
					"#2ecc71",
					"#3498db"
				  ],
				  data: [(idle/(idle+active)*100).toFixed(2),(active/(idle+active)*100).toFixed(2)]
				}]
			}
		});
	}
	
	function updateFenceChart(chartData){
		var ctx = document.getElementById("myChart2").getContext('2d');
		var psaData = chartData[0];
		var depotData = chartData[1];
		var whData = chartData[2];
		var compData = chartData[3];
		var totalData = psaData + depotData + whData +compData;
		var myChart = new Chart(ctx, {
			type: 'pie',
			data: {
			labels: ['PSA','Depot','Warehouse','Company'],
			datasets: [{
				  backgroundColor: [
					"#2ecc71",
					"#3498db",
					"#ff6961",
					"#fdfd96"
				  ],
				  data: [((psaData/totalData)*100).toFixed(2),((depotData/totalData)*100).toFixed(2),((whData/totalData)*100).toFixed(2),((compData/totalData)*100).toFixed(2)]
				}]
			}
		});
	}
	
	function updateUtilChartX(work,notWork){
	var ctx = document.getElementById("myChart3").getContext('2d');
		var myChart = new Chart(ctx, {
			type: 'pie',
			data: {
			labels: ["Working", "Not Working"],
			datasets: [{
				  backgroundColor: [
					"#66cc66",
					"#ff6666"
				  ],
				  data: [8.3,2.3]
				}]
			}
		});
	}
/* 	
	function updateUtilChart(){
	var ctx = document.getElementById("myChart3").getContext('2d');
		var myChart = new Chart(ctx, {
			type: 'pie',
			data: {
			labels: ["Utilized", "Not Utilized"],
			datasets: [{
				  backgroundColor: [
					"#2ecc71",
					"#ff6961"
				  ],
				  data: [(7.6/24).toFixed(2),((24-7.6)/24).toFixed(2)]
				}]
			}
		});
	} */
	
	function getVehicleEtc() {
		$.ajax({
			url : 'http://dev.logistics.lol:3000/node/vehicle/XB9597R/datetime/2015-01-08/speed/120',
			type : 'GET',
			dataType:'json',
			success : function(data) {  
				getDataOut(data[0].idleCount);
			}
		});
	}
	
	function idleTime(){
		partOne();
		partTwo();
		
	}
	
	function setText(id,value) {
		var veh = document.getElementById("vehText");
		veh.innerHTML = "Vehicle # " + "XB9597R";

	}  
	
		window.onload=function() {
			setText("vehText","Hello there");
		}
	
	function partTwo() {
		$.ajax({
			url : 'http://dev.logistics.lol:3000/node/vehicle/XB9597R/datetime/2015-01-08/speed/120',
			type : 'GET',
			dataType:'json',
			success : function(data) {  
				getDataOut(data[0].idleCount);
			}
		});
	}
	
	$("#button").click(function(){
    if($(this).html() == "-"){
        $(this).html("+");
    }
    else{
        $(this).html("-");
    }
    $("#grid-1-2").slideToggle();
	});
	
	$('.form').find('input, textarea').on('keyup blur focus', function (e) {
  
	  var $this = $(this),
		  label = $this.prev('label');

		  if (e.type === 'keyup') {
				if ($this.val() === '') {
			  label.removeClass('active highlight');
			} else {
			  label.addClass('active highlight');
			}
		} else if (e.type === 'blur') {
			if( $this.val() === '' ) {
				label.removeClass('active highlight'); 
				} else {
				label.removeClass('highlight');   
				}   
		} else if (e.type === 'focus') {
		  
		  if( $this.val() === '' ) {
				label.removeClass('highlight'); 
				} 
		  else if( $this.val() !== '' ) {
				label.addClass('highlight');
				}
		}

	});

	$('.tab a').on('click', function (e) {
	  
	  e.preventDefault();
	  
	  $(this).parent().addClass('active');
	  $(this).parent().siblings().removeClass('active');
	  
	  target = $(this).attr('href');

	  $('.tab-content > div').not(target).hide();
	  
	  $(target).fadeIn(600);
	  
	});

</script>